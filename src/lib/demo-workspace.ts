import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function daysAgo(days: number, hour = 12, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export async function ensureDemoWorkspace(ownerUserId: string): Promise<string> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
      demoWorkspace: { select: { id: true } },
    },
  });

  if (!owner) throw new Error("Owner not found.");
  if (owner.demoWorkspace?.id) return owner.demoWorkspace.id;

  const [local] = owner.email.split("@");
  const demoEmail = `${local}+demo@aucosto.local`;
  const demoPassword = await bcrypt.hash(`demo-${owner.id}`, 10);

  const demoUser = await prisma.user.create({
    data: {
      name: `${owner.name ?? "Aucosto"} Demo`,
      email: demoEmail,
      password: demoPassword,
      timezone: owner.timezone,
      financeVisible: true,
      isDemo: true,
      demoOwnerId: owner.id,
    },
  });

  await seedDemoWorkspaceData(demoUser.id);
  return demoUser.id;
}

export async function seedDemoWorkspaceData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.event.deleteMany({ where: { userId } });
    await tx.financeTransaction.deleteMany({ where: { userId } });
    await tx.financeGoal.deleteMany({ where: { userId } });
    await tx.financeAccount.deleteMany({ where: { userId } });
    await tx.financeConnection.deleteMany({ where: { userId } });
    await tx.timeEntry.deleteMany({ where: { userId } });

    const checking = await tx.financeAccount.create({
      data: {
        userId,
        name: "Northstar Checking",
        kind: "checking",
        includeInCashPosition: true,
        includeInNetWorth: true,
        currentBalanceCents: 486500,
        balanceUpdatedAt: daysAgo(0, 9, 30),
      },
    });

    const savings = await tx.financeAccount.create({
      data: {
        userId,
        name: "Calm Buffer Savings",
        kind: "savings",
        includeInCashPosition: true,
        includeInNetWorth: true,
        currentBalanceCents: 1240000,
        balanceUpdatedAt: daysAgo(0, 9, 30),
      },
    });

    const card = await tx.financeAccount.create({
      data: {
        userId,
        name: "Orbit Rewards Card",
        kind: "credit_card",
        includeInCashPosition: false,
        includeInNetWorth: true,
        currentBalanceCents: -94200,
        statementBalanceCents: -101600,
        dueDate: daysAgo(-6, 12, 0),
        creditLimitCents: 500000,
        balanceUpdatedAt: daysAgo(0, 9, 30),
      },
    });

    await tx.financeGoal.createMany({
      data: [
        {
          userId,
          name: "Wedding weekend",
          owner: "shared",
          category: "wedding",
          targetAmountCents: 650000,
          currentAmountCents: 428000,
          monthlyContributionCents: 60000,
          targetDate: daysAgo(-140),
          status: "active",
          notes: "Demo goal for showcasing buckets and progress.",
        },
        {
          userId,
          name: "Slow travel fund",
          owner: "self",
          category: "travel",
          targetAmountCents: 240000,
          currentAmountCents: 92000,
          monthlyContributionCents: 25000,
          targetDate: daysAgo(-220),
          status: "active",
        },
      ],
    });

    await tx.financeTransaction.createMany({
      data: [
        {
          userId,
          financeAccountId: checking.id,
          syncSource: "demo",
          date: daysAgo(15, 8, 0),
          amount: 285000,
          description: "Studio retainer",
          account: checking.name,
          category: "Income",
        },
        {
          userId,
          financeAccountId: checking.id,
          syncSource: "demo",
          date: daysAgo(12, 13, 15),
          amount: -8450,
          description: "Sunrise Grocers",
          account: checking.name,
          category: "Groceries",
        },
        {
          userId,
          financeAccountId: card.id,
          syncSource: "demo",
          date: daysAgo(10, 18, 20),
          amount: -6800,
          description: "Luma Pizza",
          account: card.name,
          category: "Food & Drink",
        },
        {
          userId,
          financeAccountId: card.id,
          syncSource: "demo",
          date: daysAgo(8, 9, 10),
          amount: -12000,
          description: "Cloudyard Hosting",
          account: card.name,
          category: "Subscriptions",
        },
        {
          userId,
          financeAccountId: checking.id,
          syncSource: "demo",
          date: daysAgo(7, 10, 30),
          amount: -35000,
          description: "Rent transfer",
          account: checking.name,
          category: "Housing",
        },
        {
          userId,
          financeAccountId: card.id,
          syncSource: "demo",
          date: daysAgo(6, 14, 5),
          amount: -2400,
          description: "Blue Line Transit",
          account: card.name,
          category: "Transport",
        },
        {
          userId,
          financeAccountId: checking.id,
          syncSource: "demo",
          date: daysAgo(5, 16, 45),
          amount: -15000,
          description: "Wedding bucket transfer",
          account: checking.name,
          category: "Transfer",
        },
        {
          userId,
          financeAccountId: savings.id,
          syncSource: "demo",
          date: daysAgo(5, 16, 46),
          amount: 15000,
          description: "Wedding bucket transfer",
          account: savings.name,
          category: "Transfer",
        },
        {
          userId,
          financeAccountId: card.id,
          syncSource: "demo",
          date: daysAgo(4, 11, 5),
          amount: -5400,
          description: "Northlight Coffee",
          account: card.name,
          category: "Food & Drink",
        },
        {
          userId,
          financeAccountId: checking.id,
          syncSource: "demo",
          date: daysAgo(2, 8, 20),
          amount: 95000,
          description: "Client milestone",
          account: checking.name,
          category: "Income",
        },
        {
          userId,
          financeAccountId: card.id,
          syncSource: "demo",
          date: daysAgo(1, 17, 50),
          amount: -18900,
          description: "Harbor Home",
          account: card.name,
          category: "Home",
        },
      ],
    });

    await tx.timeEntry.createMany({
      data: [
        {
          userId,
          label: "Landing page polish",
          category: "build",
          startedAt: daysAgo(2, 8, 0),
          endedAt: daysAgo(2, 9, 35),
        },
        {
          userId,
          label: "Client prep and notes",
          category: "admin",
          startedAt: daysAgo(1, 10, 15),
          endedAt: daysAgo(1, 11, 5),
        },
        {
          userId,
          label: "Deep work sprint",
          category: "focus",
          startedAt: daysAgo(0, 7, 45),
          endedAt: daysAgo(0, 9, 20),
        },
        {
          userId,
          label: "Demo walkthrough tweaks",
          category: "demo",
          startedAt: daysAgo(0, 9, 35),
          endedAt: null,
        },
      ],
    });

    await tx.event.createMany({
      data: [
        {
          userId,
          tool: "finance",
          type: "finance.imported",
          at: daysAgo(4, 12, 0),
          meta: JSON.stringify({ source: "demo" }),
        },
        {
          userId,
          tool: "time",
          type: "time.started",
          at: daysAgo(0, 9, 35),
          meta: JSON.stringify({ label: "Demo walkthrough tweaks", category: "demo" }),
        },
      ],
    });
  });
}
