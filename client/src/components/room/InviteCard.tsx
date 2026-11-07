import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/state/store";
import { copyText, inviteLink } from "@/utils/format";
import { CopyIcon, ShareIcon } from "@/components/ui/Icons";

export default function InviteCard({ code }: { code: string }) {
  const link = inviteLink(code);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my SyncWave room", text: `Join my SyncWave room — code ${code}`, url: link });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    if (await copyText(link)) toast("Link copied", "success");
  };

  return (
    <div className="rounded-[24px] border border-line bg-white/[0.04] p-4">
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-[16px] bg-white p-3 shadow-[0_12px_32px_rgb(0_0_0/0.35)]">
          <QRCodeSVG value={link} size={104} level="M" bgColor="#ffffff" fgColor="#0a0a0c" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted">Room code</div>
          <div className="mt-1 text-lg font-semibold tracking-[0.12em]">{code}</div>
          <div className="mt-1 text-sm text-muted">Scan or share the link — no app needed.</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-primary" onClick={share}>
          <ShareIcon size={18} /> Invite
        </button>
        <button className="btn btn-secondary" onClick={async () => (await copyText(link)) && toast("Link copied", "success")}>
          <CopyIcon size={18} /> Copy link
        </button>
      </div>
    </div>
  );
}
