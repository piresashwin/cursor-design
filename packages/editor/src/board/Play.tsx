import { PrototypeShell } from "./PrototypeShell";
import type { Doc } from "@cursor-design/core";

type Props = {
  doc: Doc;
  startFrameId: string;
  onExit: () => void;
};

/** Editor Play mode — thin wrapper around the shared prototype shell. */
export function Play({ doc, startFrameId, onExit }: Props) {
  return <PrototypeShell doc={doc} startFrameId={startFrameId} onExit={onExit} />;
}
