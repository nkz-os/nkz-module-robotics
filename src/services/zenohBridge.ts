export function robotTopic(tenantId: string, robotId: string, channel: string): string {
  return `nkz/${tenantId}/${robotId}/${channel}`;
}
