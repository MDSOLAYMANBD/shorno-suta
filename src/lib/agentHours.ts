// Live agent working hours utility (Asia/Dhaka, default 10 AM – 9 PM)
// Defaults can be overridden via store_settings (live_agent_start_hour, live_agent_end_hour)

export function getDhakaHour(): number {
  // Get current hour in Asia/Dhaka
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour')?.value;
  return parseInt(h || '0', 10);
}

export function isAgentOnline(startHour = 10, endHour = 21): boolean {
  const h = getDhakaHour();
  return h >= startHour && h < endHour;
}

export function agentStatusText(startHour = 10, endHour = 21): string {
  return isAgentOnline(startHour, endHour)
    ? 'এজেন্ট অনলাইন'
    : `এজেন্ট অফলাইন · সকাল ${startHour}টা - রাত ${endHour - 12}টা পর্যন্ত`;
}
