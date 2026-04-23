import { paginationQuerySchema, paginate } from "../utils/pagination";

jest.mock("../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn((ops: Array<Promise<unknown>>) => Promise.all(ops)),
  },
}));

describe("paginationQuerySchema", () => {
  it("applies defaults when page/pageSize absent", () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces string inputs to numbers", () => {
    const parsed = paginationQuerySchema.parse({ page: "3", pageSize: "50" });
    expect(parsed).toEqual({ page: 3, pageSize: 50 });
  });

  it("rejects page < 1", () => {
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
  });

  it("rejects pageSize > 100", () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it("rejects pageSize < 1", () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 0 })).toThrow();
  });
});

describe("paginate()", () => {
  const makeModel = (items: unknown[], total: number) => ({
    findMany: jest.fn().mockResolvedValue(items),
    count: jest.fn().mockResolvedValue(total),
  });

  it("computes skip/take from page and pageSize", async () => {
    const model = makeModel([{ id: "a" }], 47);
    await paginate(model, { page: 3, pageSize: 10 });
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it("returns structured envelope with totalPages", async () => {
    const model = makeModel([{ id: "a" }, { id: "b" }], 47);
    const result = await paginate(model, { page: 2, pageSize: 10 });
    expect(result).toEqual({
      items: [{ id: "a" }, { id: "b" }],
      page: 2,
      pageSize: 10,
      total: 47,
      totalPages: 5,
    });
  });

  it("forwards where clause to both findMany and count", async () => {
    const model = makeModel([], 0);
    const where = { isBooked: false };
    await paginate(model, { page: 1, pageSize: 20, where });
    expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(model.count).toHaveBeenCalledWith({ where });
  });

  it("forwards orderBy and include when provided", async () => {
    const model = makeModel([], 0);
    await paginate(model, {
      page: 1,
      pageSize: 20,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
    );
  });

  it("handles zero results", async () => {
    const model = makeModel([], 0);
    const result = await paginate(model, { page: 1, pageSize: 20 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});
