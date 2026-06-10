// License: Apache-2.0

use architoken_database_manager::graph_sidecar;
use std::{error::Error, net::SocketAddr};
use tokio::net::TcpListener;

const DEFAULT_ADDR: &str = "127.0.0.1:8088";

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    if std::env::args().any(|arg| arg == "--healthcheck") {
        let addr = std::env::var("ARCHITOKEN_GRAPH_SIDECAR_HEALTH_ADDR")
            .or_else(|_| std::env::var("ARCHITOKEN_GRAPH_SIDECAR_ADDR"))
            .unwrap_or_else(|_| DEFAULT_ADDR.to_owned())
            .replace("0.0.0.0:", "127.0.0.1:");
        std::net::TcpStream::connect(addr)?;
        return Ok(());
    }

    let state = graph_sidecar::connect_graph_sidecar_pool().await?;
    let addr = std::env::var("ARCHITOKEN_GRAPH_SIDECAR_ADDR")
        .unwrap_or_else(|_| DEFAULT_ADDR.to_owned())
        .parse::<SocketAddr>()?;
    let listener = TcpListener::bind(addr).await?;

    println!("architoken-graph-sidecar listening on http://{addr}");
    axum::serve(listener, graph_sidecar::router(state)).await?;

    Ok(())
}
