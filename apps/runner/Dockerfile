FROM criyle/go-judge:v1.12.3@sha256:6558c41279376868887f1e9e7db857df660449aff998aa2be799e910ad98a723

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gcc g++ golang-go default-jdk-headless nodejs node-typescript \
    python3 rustc \
    && rm -rf /var/lib/apt/lists/* /var/cache/*
