// License: Apache-2.0

use architoken_database_manager::http;
use std::{error::Error, net::SocketAddr};
use tokio::net::TcpListener;

const DEFAULT_ADDR: &str = "127.0.0.1:8751";

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    if std::env::args().any(|arg| arg == "--healthcheck") {
        let addr = std::env::var("ARCHITOKEN_DB_MANAGER_HEALTH_ADDR")
            .or_else(|_| std::env::var("ARCHITOKEN_DB_MANAGER_ADDR"))
            .unwrap_or_else(|_| DEFAULT_ADDR.to_owned())
            .replace("0.0.0.0:", "127.0.0.1:");
        std::net::TcpStream::connect(addr)?;
        return Ok(());
    }

    let addr = std::env::var("ARCHITOKEN_DB_MANAGER_ADDR")
        .unwrap_or_else(|_| DEFAULT_ADDR.to_owned())
        .parse::<SocketAddr>()?;
    let listener = TcpListener::bind(addr).await?;

    println!("architoken-db-manager listening on http://{addr}");
    axum::serve(listener, http::router()).await?;

    Ok(())
}
