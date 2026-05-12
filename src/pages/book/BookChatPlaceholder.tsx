import { MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';

export default function BookChatPlaceholder() {
  return (
    <>
      <PageHeader title="צ׳אט AI" description="עוזר חכם להזמנת תורים" />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-teal-400 text-white shadow-lg shadow-primary/30">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold">בקרוב — עוזר AI חכם</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            תוכל לכתוב "אני רוצה תור לרופא משפחה ביום חמישי בבוקר" וה-AI ימצא רופא, יבדוק זמינות
            ויקבע את התור עבורך — הכל בשיחה אחת.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
