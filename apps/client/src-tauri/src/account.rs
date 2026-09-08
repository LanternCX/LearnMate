use keyring::Entry;
use reqwest::{blocking::Client, header, Method};
use serde::Serialize;
use std::{sync::Mutex, time::Duration};

static ACCOUNT_REQUEST_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize)]
pub struct Response {
    status: u16,
    body: String,
}

fn allowed(method: &str, path: &str) -> bool {
    matches!(
        (method, path),
        ("GET", "/me")
            | ("PATCH", "/me")
            | ("DELETE", "/me")
            | ("PUT", "/me/password")
            | ("PUT", "/me/avatar")
            | ("POST", "/auth/register/start")
            | ("POST", "/auth/register/complete")
            | ("POST", "/auth/login")
            | ("POST", "/auth/logout")
            | ("POST", "/auth/logout-all")
            | ("POST", "/auth/reset/start")
            | ("POST", "/auth/reset/complete")
            | ("POST", "/me/email/start")
            | ("POST", "/me/email/complete")
    )
}

fn request(
    path: String,
    method: String,
    body: Option<String>,
    expected_user: String,
) -> Result<Response, String> {
    if !allowed(&method, &path)
        || body
            .as_ref()
            .is_some_and(|value| value.len() > 3 * 1024 * 1024)
    {
        return Err("Invalid account request".into());
    }
    if cfg!(target_os = "android") {
        return Err("Android secure credential storage must be configured before use".into());
    }
    let _guard = ACCOUNT_REQUEST_LOCK
        .lock()
        .map_err(|_| "Account request unavailable")?;
    let base = api_origin()?;
    let entry = Entry::new("com.lanterncx.zhiya.session", base)
        .map_err(|_| "Secure storage unavailable")?;
    let token = match entry.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => String::new(),
        Err(_) => return Err("Unable to read secure storage".into()),
    };
    let client = Client::builder()
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Network unavailable")?;
    let mut builder = client
        .request(
            Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid method")?,
            format!("{}/api{}", base.trim_end_matches('/'), path),
        )
        .header(header::CONTENT_TYPE, "application/json")
        .header("X-Zhiya-Request", "1");
    if !token.is_empty() {
        builder = builder.header(header::COOKIE, format!("zhiya_session={token}"));
    }
    if !expected_user.is_empty() {
        builder = builder.header("X-Zhiya-User", expected_user);
    }
    if let Some(body) = body {
        builder = builder.body(body);
    }
    let response = builder
        .send()
        .map_err(|_| "Unable to connect to account server")?;
    let status = response.status().as_u16();
    store_session(&entry, &client, base, response.headers())?;
    let body = response
        .text()
        .map_err(|_| "Unable to read account response")?;
    Ok(Response { status, body })
}

fn api_origin() -> Result<&'static str, String> {
    let base = option_env!("ZHIYA_API_URL").unwrap_or(if cfg!(debug_assertions) {
        "http://127.0.0.1:8080"
    } else {
        ""
    });
    let url =
        reqwest::Url::parse(base).map_err(|_| "Set ZHIYA_API_URL when building the application")?;
    let local = cfg!(debug_assertions)
        && url.scheme() == "http"
        && matches!(url.host_str(), Some("127.0.0.1") | Some("localhost"));
    if (!local && url.scheme() != "https")
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("ZHIYA_API_URL must be an HTTPS origin".into());
    }
    Ok(base)
}

fn store_session(
    entry: &Entry,
    client: &Client,
    base: &str,
    headers: &header::HeaderMap,
) -> Result<(), String> {
    for cookie in headers.get_all(header::SET_COOKIE) {
        let value = cookie.to_str().map_err(|_| "Invalid session response")?;
        if let Some(value) = value.strip_prefix("zhiya_session=") {
            let value = value.split(';').next().unwrap_or("");
            if value.is_empty() {
                match entry.delete_credential() {
                    Ok(()) | Err(keyring::Error::NoEntry) => (),
                    Err(_) => return Err("Unable to clear secure storage".into()),
                }
            } else {
                if value.len() != 64 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
                    return Err("Invalid session".into());
                }
                if entry.set_password(value).is_err() {
                    let _ = client
                        .post(format!("{}/api/auth/logout", base.trim_end_matches('/')))
                        .header(header::COOKIE, format!("zhiya_session={value}"))
                        .header("X-Zhiya-Request", "1")
                        .header(header::CONTENT_TYPE, "application/json")
                        .body("{}")
                        .send();
                    return Err("Unable to save login in secure storage".into());
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn account_request(
    path: String,
    method: String,
    body: Option<String>,
    expected_user: String,
) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || request(path, method, body, expected_user))
        .await
        .map_err(|_| "Account request failed".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_bridge_rejects_other_destinations_and_operations() {
        for path in [
            "https://example.com",
            "//example.com",
            "/me/../admin",
            "/admin/users",
        ] {
            assert!(request(path.into(), "GET".into(), None, String::new()).is_err());
        }
        assert!(request("/me".into(), "TRACE".into(), None, String::new()).is_err());
    }
}
