-- 共享订单：同一 (date, timeSlot) 合并为一个订单
-- 1) OrderItem 记录「谁加的」
ALTER TABLE "OrderItem" ADD COLUMN "addedByUserId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "addedByName" TEXT;

-- 2) 先把同一 (date, timeSlot) 下重复订单的明细，全部挂到最早创建的订单上，
--    否则加唯一索引会失败（老数据里每人一单，同一时段可能有多条）
UPDATE "OrderItem" oi
SET "orderId" = keep.id
FROM "Order" o
JOIN LATERAL (
  SELECT o2.id
  FROM "Order" o2
  WHERE o2."date" = o."date" AND o2."timeSlot" = o."timeSlot"
  ORDER BY o2."createdAt" ASC, o2."id" ASC
  LIMIT 1
) keep ON true
WHERE oi."orderId" = o.id AND oi."orderId" <> keep.id;

-- 3) 删除被合并掉的重复订单
DELETE FROM "Order" o
WHERE o.id <> (
  SELECT o2.id
  FROM "Order" o2
  WHERE o2."date" = o."date" AND o2."timeSlot" = o."timeSlot"
  ORDER BY o2."createdAt" ASC, o2."id" ASC
  LIMIT 1
);

-- 4) 一个 (date, timeSlot) 只能有一个共享订单
CREATE UNIQUE INDEX "Order_date_timeSlot_key" ON "Order"("date", "timeSlot");

-- 5) 给旧明细回填 addedBy（用其所属订单的创建者），新明细由代码写入
UPDATE "OrderItem" oi
SET "addedByUserId" = o."userId", "addedByName" = o."guestName"
FROM "Order" o
WHERE oi."orderId" = o.id AND oi."addedByUserId" IS NULL;
