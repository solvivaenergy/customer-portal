import { Bell } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Card, EmptyState, PageHeader } from "@/components/ui";

/** Placeholder: there is no notification source yet (no user story, no data). */
export default function NotificationsPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Notifications" }]} />
      <PageHeader title="Notifications" subtitle="Updates about your system, tickets and PMS requests will appear here." />
      <Card padded={false}>
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications yet" description="You're all caught up. We'll let you know when there is something new." />
      </Card>
    </>
  );
}
