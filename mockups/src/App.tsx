import { Navigate, Route, Routes } from "react-router-dom";
import { JourneyNav } from "./components/JourneyNav";
import { EmptyPage } from "./pages/EmptyPage";
import { SystemForkPage } from "./pages/system/SystemForkPage";
import { SystemImportPage } from "./pages/system/SystemImportPage";
import { SystemGeneratePage } from "./pages/system/SystemGeneratePage";
import { SystemWorkspacePage } from "./pages/system/SystemWorkspacePage";
import { SystemExportPage } from "./pages/system/SystemExportPage";
import { EditorPage } from "./pages/EditorPage";
import { AnnotatePage } from "./pages/AnnotatePage";
import { ExportPage } from "./pages/ExportPage";
import { PlayPage } from "./pages/PlayPage";
import { McpErrorPage, NoFilePage } from "./pages/ErrorPages";

export default function App() {
  return (
    <div className="app-root">
      <JourneyNav />
      <Routes>
        <Route path="/" element={<EmptyPage />} />
        <Route path="/system" element={<SystemForkPage />} />
        <Route path="/system/import" element={<SystemImportPage />} />
        <Route path="/system/generate" element={<SystemGeneratePage />} />
        <Route path="/system/workspace" element={<SystemWorkspacePage />} />
        <Route path="/system/export" element={<SystemExportPage />} />
        <Route path="/board" element={<EditorPage mode="board" />} />
        <Route path="/board/live" element={<EditorPage mode="live" />} />
        <Route path="/review" element={<AnnotatePage />} />
        <Route path="/ship" element={<ExportPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/error/no-file" element={<NoFilePage />} />
        <Route path="/error/mcp" element={<McpErrorPage />} />
        <Route path="/tokens" element={<Navigate to="/system" replace />} />
        <Route path="/export" element={<Navigate to="/ship" replace />} />
        <Route path="/editor" element={<Navigate to="/board" replace />} />
        <Route path="/editor/agent" element={<Navigate to="/board/live" replace />} />
        <Route path="/editor/agent-pane" element={<Navigate to="/board/live" replace />} />
        <Route path="/editor/ask" element={<Navigate to="/review" replace />} />
        <Route path="/editor/annotate" element={<Navigate to="/review" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
