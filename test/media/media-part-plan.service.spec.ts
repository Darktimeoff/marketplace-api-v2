import { describe, expect, it } from 'vitest';
import { MediaPartPlanService } from '../../src/media/service/media-part-plan.service.js';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const plan = new MediaPartPlanService();

describe('MediaPartPlanService', () => {
  it('uploads files below two minimal parts in a single PUT', () => {
    expect(plan.isMultipart(10 * MIB - 1)).toBe(false);
    expect(plan.isMultipart(10 * MIB)).toBe(true);
  });

  it('keeps the 5 MiB minimum while it fits in 10 000 parts', () => {
    expect(plan.partSize(11 * MIB)).toBe(5 * MIB);
    expect(plan.partCount(11 * MIB)).toBe(3);
    expect(plan.partSize(5 * GIB)).toBe(5 * MIB);
    expect(plan.partCount(5 * GIB)).toBe(1024);
  });

  it('grows the part to whole mebibytes so a 100 GiB file still fits in 10 000 parts', () => {
    expect(plan.partSize(100 * GIB)).toBe(11 * MIB);
    expect(plan.partCount(100 * GIB)).toBeLessThanOrEqual(10_000);
  });

  it('makes only the last part smaller', () => {
    expect(plan.partLength(11 * MIB, 1)).toBe(5 * MIB);
    expect(plan.partLength(11 * MIB, 2)).toBe(5 * MIB);
    expect(plan.partLength(11 * MIB, 3)).toBe(1 * MIB);
  });
});
