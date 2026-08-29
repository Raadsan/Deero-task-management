import { prisma } from "../lib/prisma.js";

const DEERO_CATEGORIES = [
  "Graphic Design",
  "Digital Marketing",
  "Branding",
  "Video Production",
  "Printing",
  "Web Solutions",
  "Web Hosting",
  "Event Branding",
  "Custom Service",
];

async function ensureCategory(name) {
  return prisma.product_categories.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

export async function syncAllMenuAccountingProducts() {
  try {
    const [subServices, revenueAccount, expenseAccount] = await Promise.all([
      prisma.subService.findMany({ include: { service: true } }),
      prisma.chart_of_accounts.findFirst({
        where: { code: "4100", is_active: true, account_types: { internal_group: "income" } },
        orderBy: { id: "asc" },
      }),
      prisma.chart_of_accounts.findFirst({
        where: { code: "5100", is_active: true, account_types: { internal_group: "expense" } },
        orderBy: { id: "asc" },
      }),
    ]);

    const categories = new Map();
    for (const name of DEERO_CATEGORIES) categories.set(name, await ensureCategory(name));

    for (const item of subServices) {
      const categoryName = item.service?.serviceName || "Custom Service";
      const category = categories.get(categoryName) || await ensureCategory(categoryName);
      categories.set(categoryName, category);

      const sku = `SRV-${item.id.slice(0, 10)}`;
      const name = `${categoryName} - ${item.name}`;
      const productData = {
        name,
        description: item.description || `${item.name} provided under ${categoryName}`,
        product_type: "service",
        category_id: category.id,
        uom: "service",
        can_be_sold: true,
        can_be_purchased: false,
        list_price: Number(item.price || 0),
        standard_cost: 0,
        income_account_id: revenueAccount?.id || null,
        expense_account_id: expenseAccount?.id || null,
        is_active: true,
      };

      const existing = await prisma.products.findFirst({ where: { OR: [{ sku }, { name }] } });
      if (existing) {
        await prisma.products.update({ where: { id: existing.id }, data: { ...productData, sku } });
      } else {
        await prisma.products.create({ data: { ...productData, sku } });
      }
    }
  } catch (error) {
    console.warn("[product-sync] Warning:", error.message);
  }
}