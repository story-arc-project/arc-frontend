// Browser counts cannot establish lifetime first completion. Retained for legacy callers.
export function markFirstRecordIfUnseen(_count: number, _emailSeed: string): Promise<boolean> {
  void _count;
  void _emailSeed;
  return Promise.resolve(false);
}
