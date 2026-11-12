import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Modal } from "@/components/ui";

/** Every "Log out" in the portal asks first (Alden, 2026-11-12); confirming signs out and goes to the login page. */
export function LogoutConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Log out">
      <p className="text-sm text-neutral-600">Are you sure you want to log out?</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
              navigate("/login", { replace: true });
            } finally {
              setBusy(false);
            }
          }}
        >
          Log out
        </Button>
      </div>
    </Modal>
  );
}
