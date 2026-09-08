fn main() {
    for name in [
        "ZHIYA_BUILD_API_ORIGIN",
        "ZHIYA_BUILD_REQUEST_TIMEOUT_SECONDS",
    ] {
        println!("cargo:rerun-if-env-changed={name}");
    }
    tauri_build::build()
}
