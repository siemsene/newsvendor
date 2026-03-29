import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s, colors } from "./styles";
import { GuidePage } from "./components/GuidePage";
import { GuideSection } from "./components/GuideSection";
import { GuideTable } from "./components/GuideTable";
import { GuideTip } from "./components/GuideTip";

const GUIDE = "Player's Guide";

function Bullet({ children }: { children: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function NumItem({ n, children }: { n: number; children: string }) {
  return (
    <View style={s.numRow}>
      <Text style={s.numLabel}>{n}.</Text>
      <Text style={s.numText}>{children}</Text>
    </View>
  );
}

export function PlayerGuide() {
  return (
    <Document title="Croissant Lab — Player's Guide" author="Croissant Lab">
      {/* ─── Cover ─── */}
      <Page size="LETTER" style={s.coverPage}>
        <View style={s.coverBg} />
        <Text style={s.coverTitle}>Croissant Lab</Text>
        <Text style={s.coverSubtitle}>Player's Guide</Text>
        <Text style={s.coverTagline}>
          A Newsvendor Simulation Game
        </Text>
      </Page>

      {/* ─── Page 1: Overview ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Welcome to Croissant Lab">
          <Text style={s.body}>
            Welcome to Croissant Lab! You are the owner of a small croissant
            bakery. Each week you must decide how many croissants to bake per
            day — but you do not know exactly how many customers will show up.
            Bake too many and you waste ingredients; bake too few and you miss
            out on sales.
          </Text>
          <Text style={s.body}>
            Your goal is to maximize your cumulative profit over the course of
            the game by making smart ordering decisions under uncertainty. This
            is known as the "newsvendor problem" — one of the most important
            models in operations management.
          </Text>
        </GuideSection>

        <GuideSection title="Game Overview">
          <Text style={s.body}>The game follows this flow:</Text>
          <NumItem n={1}>
            Join a session using the code provided by your instructor.
          </NumItem>
          <NumItem n={2}>
            Review the training data to learn about customer demand patterns.
          </NumItem>
          <NumItem n={3}>
            Each week, submit your bake plan — the number of croissants to
            bake per day.
          </NumItem>
          <NumItem n={4}>
            Watch as daily demand is revealed and see your profit for each day.
          </NumItem>
          <NumItem n={5}>
            Repeat for all weeks, then view the final leaderboard and results.
          </NumItem>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 2: Joining ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Joining a Session">
          <Text style={s.body}>
            To join a game session:
          </Text>
          <NumItem n={1}>
            Go to the Croissant Lab website.
          </NumItem>
          <NumItem n={2}>
            Enter the session code your instructor has shared (e.g., "GAME1").
            The code is case-insensitive.
          </NumItem>
          <NumItem n={3}>
            Enter your display name. This is how you will appear on the
            leaderboard.
          </NumItem>
          <NumItem n={4}>
            Click "Start baking" to enter the game.
          </NumItem>
          <Text style={s.body}>
            If a player with the same name already exists in the session, you
            will be asked whether you want to take over that player's session.
            This is useful if you accidentally close your browser and need to
            rejoin.
          </Text>
          <GuideTip>
            Bookmark or keep the game tab open. If you close it, you can rejoin
            using the same session code and name.
          </GuideTip>
        </GuideSection>

        <GuideSection title="The Game Screen">
          <Text style={s.body}>
            Once you join, you will see a game screen with several areas:
          </Text>
          <Bullet>
            Top bar: Your name, session code, cumulative profit, and game
            parameters (sell price, cost, salvage value, and your rank).
          </Bullet>
          <Bullet>
            Left panel: A demand data chart showing the distribution of
            historical and in-game demand.
          </Bullet>
          <Bullet>
            Right panel: The revealed demand area showing daily results for the
            current week.
          </Bullet>
          <Bullet>
            Center: The order input section where you submit your weekly bake
            plan.
          </Bullet>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 3: Training Data ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Understanding the Training Data">
          <Text style={s.body}>
            Before the game begins, your instructor will share training data —
            a set of historical demand observations. This data helps you
            understand what customer demand typically looks like.
          </Text>
          <Text style={s.h3}>Demand Histogram</Text>
          <Text style={s.body}>
            The histogram shows how frequently different demand levels have
            occurred in the past. Taller bars mean that demand level happened
            more often. The shape is typically a bell curve (normal
            distribution), centered around the mean.
          </Text>
          <Text style={s.h3}>Time Series Chart</Text>
          <Text style={s.body}>
            The time series chart shows demand values plotted over time. A gray
            line shows the training period, and once the game starts, an
            orange line shows the actual in-game demands as they are revealed.
            A dashed vertical line separates training data from game data.
          </Text>
          <Text style={s.h3}>Key Statistics</Text>
          <Text style={s.body}>
            Below the charts you will see the sample mean and standard
            deviation of the demand data. These statistics summarize the center
            and spread of the demand distribution:
          </Text>
          <Bullet>
            Mean: The average demand level — the center of the distribution.
          </Bullet>
          <Bullet>
            Standard Deviation: How spread out demand is. A larger number means
            demand is more variable and harder to predict.
          </Bullet>
          <GuideTip>
            Pay close attention to the mean and standard deviation. These are
            your best tools for deciding how much to bake.
          </GuideTip>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 4: Making Decisions ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Making Your Weekly Decision">
          <Text style={s.body}>
            Each week, you decide on a single quantity (Q) — the number of
            croissants your bakery will bake per day for that entire week. This
            quantity stays the same for every day within the week.
          </Text>
          <Text style={s.h3}>How to Submit</Text>
          <NumItem n={1}>
            Enter a non-negative whole number in the order input field.
          </NumItem>
          <NumItem n={2}>
            Click "Submit bake plan" to lock in your decision.
          </NumItem>
          <NumItem n={3}>
            Wait for all other players to submit (in synchronous mode) or for
            demand to be revealed (in async mode).
          </NumItem>
          <Text style={s.body}>
            A progress bar shows how many players have submitted their orders
            for the current week. Once everyone has submitted, the reveal phase
            begins.
          </Text>
          <Text style={s.h3}>Submission Tracker</Text>
          <Text style={s.body}>
            In multiplayer sessions, you will see a progress bar showing
            "X of Y players have submitted." When only a couple of players
            remain, the bar turns red as a gentle reminder to hurry.
          </Text>
          <GuideTip>
            You cannot change your order once submitted. Think carefully before
            clicking submit!
          </GuideTip>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 5: Profit ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="How Profit Works">
          <Text style={s.body}>
            Your daily profit depends on how your bake quantity (Q) compares to
            actual customer demand (D). Here is what happens each day:
          </Text>
          <Bullet>
            You sell the smaller of Q or D (you cannot sell more than you baked
            or more than customers want).
          </Bullet>
          <Bullet>
            Any leftover croissants (Q minus what you sold) are salvaged at a
            reduced price.
          </Bullet>
          <Bullet>
            You pay the unit cost for every croissant you baked, regardless of
            whether it sold.
          </Bullet>
          <Text style={s.h3}>The Profit Formula</Text>
          <View style={s.formulaBox}>
            <Text style={s.formulaText}>
              Daily Profit = (Price x Sold) + (Salvage x Leftover) - (Cost x Q)
            </Text>
          </View>
          <Text style={s.body}>Where:</Text>
          <GuideTable
            headers={["Term", "Meaning"]}
            rows={[
              ["Sold", "min(Q, D) — units actually purchased by customers"],
              ["Leftover", "max(0, Q - D) — unsold units at end of day"],
              ["Price", "Revenue per croissant sold to a customer"],
              ["Cost", "Cost per croissant baked"],
              ["Salvage", "Revenue per unsold croissant (day-old discount)"],
              ["Q", "Your chosen bake quantity for the week"],
              ["D", "Actual customer demand (revealed after submission)"],
            ]}
          />
          <Text style={s.h3}>Example</Text>
          <Text style={s.body}>
            Suppose Price = $4.00, Cost = $0.50, Salvage = $0.00. You order
            Q = 120 and demand turns out to be D = 100:
          </Text>
          <Bullet>Sold = min(120, 100) = 100</Bullet>
          <Bullet>Leftover = max(0, 120 - 100) = 20</Bullet>
          <Bullet>
            Profit = (4.00 x 100) + (0.00 x 20) - (0.50 x 120) = $400 + $0
            - $60 = $340.00
          </Bullet>
          <Text style={s.body}>
            Your cumulative profit is the running total of all your daily
            profits across all weeks. It is displayed at the top of your game
            screen in green (positive) or red (negative).
          </Text>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 6: Reveal ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="The Reveal Phase">
          <Text style={s.body}>
            After all players submit their orders, the demand for each day of
            the week is revealed one at a time (in synchronous mode) or all at
            once (in async mode).
          </Text>
          <Text style={s.h3}>What You See</Text>
          <Text style={s.body}>
            The right panel shows a grid of days for the current week (e.g.,
            Monday through Friday). As each day is revealed, you see:
          </Text>
          <Bullet>
            The day name (Mon, Tue, Wed, etc.)
          </Bullet>
          <Bullet>
            The actual demand for that day
          </Bullet>
          <Bullet>
            Your profit for that day (green for positive, red for negative)
          </Bullet>
          <Bullet>
            A weather icon indicating demand relative to the mean: a sun icon
            for high demand, a cloud icon for average demand, and a rain icon
            for low demand.
          </Bullet>
          <Text style={s.h3}>Weekly Summary</Text>
          <Text style={s.body}>
            At the top of the reveal panel, you see summary statistics for the
            current week:
          </Text>
          <Bullet>
            Week: Which week you are on (e.g., Week 3/10).
          </Bullet>
          <Bullet>
            Revealed: How many of the total game days have been revealed so far.
          </Bullet>
          <Bullet>
            Plan: Your submitted order quantity for this week.
          </Bullet>
          <Bullet>
            Profit: Your total profit for this week.
          </Bullet>
          <Bullet>
            Total: Your cumulative profit across all weeks played.
          </Bullet>
          <Text style={s.h3}>Async Mode</Text>
          <Text style={s.body}>
            If your instructor has enabled async mode, you do not wait for
            other players. Demand for all days in a week is revealed
            immediately after you submit your order, and you can proceed
            straight to the next week at your own pace.
          </Text>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 7: Warnings ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Order Confirmation Prompts">
          <Text style={s.body}>
            The game includes safety checks that ask you to confirm certain
            unusual orders before they are submitted. These are not errors —
            they are simply prompts to make sure you did not make a typo.
          </Text>
          <Text style={s.h3}>Zero Order Warning</Text>
          <Text style={s.body}>
            If you submit an order of 0, you will see: "Bake nothing this
            week? You will earn nothing this week." This confirms you
            intentionally chose not to bake.
          </Text>
          <Text style={s.h3}>Large Jump Warning</Text>
          <Text style={s.body}>
            If your order is more than double your previous week's order, you
            will be asked to confirm. For example, if you ordered 80 last week
            and now enter 200, the game will flag this as an unusually large
            change.
          </Text>
          <Text style={s.h3}>Statistical Outlier Warning</Text>
          <Text style={s.body}>
            If your order is more than 4 standard deviations away from the
            demand mean, the game will prompt you to confirm. This catches
            potential typos like accidentally adding an extra digit.
          </Text>
          <Text style={s.body}>
            In all cases, you can click "Revise" to go back and change your
            order, or "Submit anyway" to proceed with your original choice.
          </Text>
          <GuideTip>
            These warnings exist to catch accidental mistakes. If you see one,
            take a moment to double-check your number before confirming.
          </GuideTip>
        </GuideSection>

        <GuideSection title="Offline and Connectivity">
          <Text style={s.body}>
            If you lose your internet connection during the game, you will see
            an offline warning banner. Orders cannot be submitted while
            offline. Once your connection is restored, you can continue
            playing. If you close and reopen the browser, your progress is
            preserved — rejoin with the same session code and name.
          </Text>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 8: Endgame ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Leaderboard and Final Results">
          <Text style={s.body}>
            Once the game is complete, you will see your final results
            including your rank and total profit.
          </Text>
          <Text style={s.h3}>Leaderboard</Text>
          <Text style={s.body}>
            The leaderboard ranks all players by cumulative profit. The top
            three players receive medal icons (gold, silver, bronze). The table
            shows each player's rank, name, total profit, and average order
            quantity.
          </Text>
          <Text style={s.body}>
            Your instructor controls when the leaderboard becomes visible. It
            may be shown during the game or only at the end.
          </Text>
          <Text style={s.h3}>Endgame Charts</Text>
          <Text style={s.body}>
            After the session ends, two analytical charts are displayed:
          </Text>
          <Text style={[s.body, s.bold]}>1. Weekly Time Series</Text>
          <Text style={s.body}>
            This chart shows three lines across the weeks of the game:
          </Text>
          <Bullet>
            Average demand (gray line) — the actual average demand each week
            across all players.
          </Bullet>
          <Bullet>
            Optimal Q (red dashed line) — the theoretically best order
            quantity given the game parameters.
          </Bullet>
          <Bullet>
            Average order (green circles) — what the group actually ordered
            on average each week.
          </Bullet>
          <Text style={s.body}>
            This chart reveals whether the group was over-ordering or
            under-ordering relative to the optimal strategy.
          </Text>
          <Text style={[s.body, s.bold]}>2. Payoff Curve</Text>
          <Text style={s.body}>
            This chart shows total profit as a function of order quantity. A
            curve traces what your total profit would have been for every
            possible fixed order quantity. A horizontal dashed line marks your
            actual profit, letting you see how close you came to the optimal
            and where you could have improved.
          </Text>
          <GuideTip>
            Use the endgame charts to reflect on your strategy. How did your
            orders compare to the group and to the theoretical optimum?
          </GuideTip>
        </GuideSection>
      </GuidePage>
    </Document>
  );
}
