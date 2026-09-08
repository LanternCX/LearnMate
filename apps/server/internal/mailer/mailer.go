package mailer

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

func New(address, from, username, password string, local bool) (func(string, string, string) error, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("SMTP_ADDR: %w", err)
	}
	sender, err := mail.ParseAddress(from)
	if err != nil || strings.ContainsAny(from, "\r\n") {
		return nil, fmt.Errorf("invalid SMTP_FROM")
	}
	if local && host != "127.0.0.1" && host != "localhost" && host != "::1" {
		return nil, fmt.Errorf("unencrypted SMTP is only allowed on loopback")
	}
	return func(to, purpose, code string) error {
		dialer := &net.Dialer{Timeout: 10 * time.Second}
		tlsConfig := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
		var conn net.Conn
		var err error
		if port == "465" {
			conn, err = tls.DialWithDialer(dialer, "tcp", address, tlsConfig)
		} else {
			conn, err = dialer.Dial("tcp", address)
		}
		if err != nil {
			return err
		}
		defer conn.Close()
		if err = conn.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
			return err
		}
		client, err := smtp.NewClient(conn, host)
		if err != nil {
			return err
		}
		defer client.Close()
		if port != "465" {
			if supported, _ := client.Extension("STARTTLS"); supported {
				if err = client.StartTLS(tlsConfig); err != nil {
					return err
				}
			} else if !local {
				return fmt.Errorf("SMTP server must support TLS")
			}
		}
		if username != "" {
			if err = client.Auth(smtp.PlainAuth("", username, password, host)); err != nil {
				return err
			}
		}
		if err = client.Mail(sender.Address); err != nil {
			return err
		}
		if err = client.Rcpt(to); err != nil {
			return err
		}
		writer, err := client.Data()
		if err != nil {
			return err
		}
		label := map[string]string{"register": "注册账号", "reset": "重设密码", "email": "验证原邮箱", "email-new": "验证新邮箱"}[purpose]
		message := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: Zhiya verification code\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n知芽 · %s\r\n\r\n验证码：%s\r\n\r\n10 分钟内有效，请勿向任何人透露。若非本人操作，请忽略这封邮件。\r\n", sender.String(), to, label, code)
		if _, err = writer.Write([]byte(message)); err != nil {
			return err
		}
		if err = writer.Close(); err != nil {
			return err
		}
		return client.Quit()
	}, nil
}
