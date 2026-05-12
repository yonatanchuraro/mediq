import { PageHeader } from '@/components/layouts/AppShell';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          העמוד הזה יבנה בקרוב. בינתיים אפשר לנהל
          {' '}
          <a href="/admin/services" className="font-medium text-primary hover:underline">
            סוגי ביקור
          </a>
          .
        </CardContent>
      </Card>
    </>
  );
}
