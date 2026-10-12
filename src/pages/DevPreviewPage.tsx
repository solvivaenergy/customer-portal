import { Logo } from "@/components/Logo";
import { CoinsIcon, HandshakeIcon } from "@/components/icons";
import { Card } from "@/components/ui";

/** Development-only page (route /dev/preview, not in the production bundle) to eyeball brand pieces without signing in. */
export default function DevPreviewPage() {
  return (
    <div className="flex min-h-screen gap-8 bg-[#fcfcfc] p-8">
      <div className="w-[296px] rounded-xl bg-brand-dark px-6 py-6">
        <Logo />
      </div>
      <div className="flex w-[304px] flex-col gap-4">
        <Card>
          <div className="flex items-start justify-between">
            <p className="text-base text-neutral-600">Total savings from solar</p>
            <CoinsIcon className="h-8 w-8" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-neutral-900">₱83,204.21</p>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <p className="text-base text-neutral-600">Referral earnings</p>
            <HandshakeIcon className="h-8 w-8" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-neutral-900">₱10,000</p>
        </Card>
        <div className="rounded-xl bg-white p-6 shadow-xs">
          <Logo variant="dark" size="lg" linkTo={null} />
        </div>
      </div>
    </div>
  );
}
