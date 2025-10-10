import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { App } from "./App"
import { ApiContext } from "./hooks/useApi"
import { UIConfigContext } from "./hooks/useUIConfig"
import { Api } from "./services/Api"
import "./index.css"

const basePath = ((window as any).__basePath__ =
  document.head.querySelector("base")?.getAttribute("href") || "")

const api = new Api({ basePath })

const uiConfig = JSON.parse(
  document.getElementById("__UI_CONFIG__")?.textContent || "{}"
)

const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <BrowserRouter basename={basePath}>
        <UIConfigContext.Provider value={uiConfig}>
          <ApiContext.Provider value={api}>
            <App />
          </ApiContext.Provider>
        </UIConfigContext.Provider>
      </BrowserRouter>
    </React.StrictMode>
  )
}
