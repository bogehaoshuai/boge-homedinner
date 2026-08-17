import { prisma } from "@/lib/prisma";
import { nextDates } from "@/lib/date";
import OrderFlow from "@/components/guest/OrderFlow";

export const metadata = { title: "今晚吃什么，你来定" };

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dishes = await prisma.dish.findMany({
    where: { available: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      category: true,
    },
  });

  const host = await prisma.user.findFirst({
    where: { role: "HOST" },
    select: { name: true },
  });

  return (
    <main>
      <Hero hostName={host?.name} dishCount={dishes.length} />
      <OrderFlow dishes={dishes} dates={nextDates(7)} />
    </main>
  );
}

function Hero({ hostName, dishCount }: { hostName?: string; dishCount: number }) {
  return (
    <section className="border-b border-line/70">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-start gap-4">
          <span className="seal mt-1 h-12 w-12 text-2xl">宴</span>
          <div>
            <p className="text-sm tracking-[0.25em] text-cinnabar">
              {hostName ? `${hostName} 的家宴` : "家的味道"} · 提前点菜
            </p>
            <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-5xl">
              今晚吃什么，
              <br className="sm:hidden" />
              你来定。
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              选个日子、挑几道想吃的菜，主人就能照着菜单去采买。菜单会随时更新，
              时下的新鲜菜都在上面。
            </p>
            <p className="mt-3 text-sm text-muted">
              今日菜单共 <span className="font-semibold text-cinnabar">{dishCount}</span>{" "}
              道菜
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
