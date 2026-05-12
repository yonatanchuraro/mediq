import { supabase } from '@/lib/supabase';

/**
 * Fire-and-forget WhatsApp trigger for an appointment.
 * Never throws — UI flows shouldn't fail because notifications failed.
 * Logs to console on error so we can diagnose without disturbing the user.
 */
export async function notifyWhatsapp(
  appointmentId: string,
  type: 'confirmation' | 'cancellation' | 'reminder_24h'
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('appointment-whatsapp', {
      body: { appointment_id: appointmentId, type },
    });
    if (error) {
      console.warn('[notifyWhatsapp]', type, error.message);
      return;
    }
    if ((data as { error?: string })?.error) {
      console.warn('[notifyWhatsapp]', type, (data as { error: string }).error);
    }
  } catch (e) {
    console.warn('[notifyWhatsapp] threw', e);
  }
}
