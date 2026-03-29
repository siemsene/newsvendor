import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { s, colors } from "./styles";
import { GuidePage } from "./components/GuidePage";
import { GuideSection } from "./components/GuideSection";
import { GuideTable } from "./components/GuideTable";
import { GuideTip } from "./components/GuideTip";

const GUIDE = "Instructor's Guide";

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

export function InstructorGuide() {
  return (
    <Document
      title="Croissant Lab — Instructor's Guide"
      author="Croissant Lab"
    >
      {/* ─── Cover ─── */}
      <Page size="LETTER" style={s.coverPage}>
        <View style={s.coverBg} />
        <Text style={s.coverTitle}>Croissant Lab</Text>
        <Text style={s.coverSubtitle}>Instructor's Guide</Text>
        <Text style={s.coverTagline}>
          Setup, Management, and Best Practices
        </Text>
      </Page>

      {/* ─── Page 1: Overview ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Welcome">
          <Text style={s.body}>
            Croissant Lab is an interactive newsvendor simulation game designed
            for classroom use. Students play the role of a bakery owner who
            must decide how many croissants to bake each day under uncertain
            demand. The game teaches core concepts in inventory management,
            decision-making under uncertainty, and the newsvendor model.
          </Text>
          <Text style={s.body}>
            As an instructor, you create and manage game sessions, configure
            the economic parameters, monitor student progress in real time, and
            facilitate debriefing discussions using the game results.
          </Text>
        </GuideSection>

        <GuideSection title="Getting Started">
          <Text style={s.h3}>Registration</Text>
          <NumItem n={1}>
            Navigate to the instructor registration page and provide your
            name, email, password, and institutional affiliation.
          </NumItem>
          <NumItem n={2}>
            Accept the terms of use and submit your application.
          </NumItem>
          <NumItem n={3}>
            Your account will be reviewed by an administrator. You will
            receive access once approved.
          </NumItem>
          <Text style={s.h3}>Logging In</Text>
          <Text style={s.body}>
            After approval, log in with your email and password. You will be
            directed to the Host Dashboard where you can create and manage
            sessions. If your account is pending, you will see a message
            indicating that your application is under review.
          </Text>
          <GuideTip>
            If you forget your password, use the "Forgot password" link on the
            login page to request a reset email.
          </GuideTip>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 2: Creating a Session ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Creating a Session">
          <Text style={s.body}>
            From the Host Dashboard, configure a new game session by setting
            the parameters below. Each parameter shapes the learning
            experience for your students.
          </Text>
          <Text style={s.h3}>Demand Distribution</Text>
          <Text style={s.body}>
            Daily customer demand is drawn from a normal distribution. You
            control the shape of this distribution:
          </Text>
          <GuideTable
            headers={["Parameter", "Description", "Default"]}
            rows={[
              [
                "Mean (mu)",
                "Center of the demand distribution. Higher means more customers on average.",
                "100",
              ],
              [
                "Std Dev (sigma)",
                "Spread of demand. Higher means more day-to-day variability.",
                "40",
              ],
            ]}
          />
          <Text style={s.body}>
            Training data (historical demand observations) is also generated
            from this distribution and shown to students before gameplay
            begins, giving them a chance to learn the demand pattern.
          </Text>
          <Text style={s.h3}>Economics</Text>
          <Text style={s.body}>
            These parameters define the profit structure of the bakery:
          </Text>
          <GuideTable
            headers={["Parameter", "Description", "Default"]}
            rows={[
              [
                "Sale Price",
                "Revenue earned per croissant sold to a customer.",
                "$4.00",
              ],
              [
                "Unit Cost",
                "Cost to produce each croissant (paid regardless of sale).",
                "$0.50",
              ],
              [
                "Salvage Value",
                "Revenue per unsold croissant (e.g., day-old discount).",
                "$0.00",
              ],
            ]}
          />
          <GuideTip>
            The ratio of these prices determines the optimal strategy. Larger
            margins (high price, low cost) push the optimal order higher.
            Adding salvage value reduces the penalty of overordering.
          </GuideTip>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 3: Duration & Options ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Duration Settings">
          <Text style={s.body}>
            Control how long the game lasts:
          </Text>
          <GuideTable
            headers={["Parameter", "Description", "Default", "Range"]}
            rows={[
              [
                "Weeks",
                "Number of ordering rounds (decisions the student makes).",
                "10",
                "1–52",
              ],
              [
                "Days per Week",
                "Number of demand days revealed per week.",
                "5",
                "1–7",
              ],
            ]}
          />
          <Text style={s.body}>
            Total game days = Weeks x Days per Week. For example, 10 weeks
            with 5 days each yields 50 days of gameplay. Students make one
            order per week that applies to every day within that week.
          </Text>
          <GuideTip>
            For a quick in-class demo, use 3–5 weeks. For a full homework
            assignment, 10 weeks provides enough data for meaningful analysis.
          </GuideTip>
        </GuideSection>

        <GuideSection title="Session Options">
          <Text style={s.h3}>Async Mode</Text>
          <Text style={s.body}>
            When enabled, each student works through all weeks at their own
            pace. Demand is revealed immediately after each order submission —
            students do not wait for each other. This mode is ideal for
            homework or out-of-class assignments where students complete the
            game independently.
          </Text>
          <Text style={s.body}>
            When disabled (default), the game runs synchronously: all students
            submit orders for the same week, then the instructor advances
            through the demand reveal together. This mode works best for live
            classroom sessions.
          </Text>
          <Text style={s.h3}>No Dragons</Text>
          <Text style={s.body}>
            Hides the decorative dragon mascot images from the player view.
            Enable this for a cleaner, more professional presentation if
            preferred.
          </Text>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 4: Optimal Q ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="The Setup Summary and Optimal Q*">
          <Text style={s.body}>
            Before launching a session, the Host Dashboard shows a setup
            summary card with the computed optimal order quantity (Q*). This
            is the theoretical best order a perfectly rational decision-maker
            would choose.
          </Text>
          <Text style={s.h3}>Critical Fractile Formula</Text>
          <Text style={s.body}>
            The newsvendor model's optimal solution uses the critical fractile:
          </Text>
          <View style={s.formulaBox}>
            <Text style={s.formulaText}>
              CF = (Price - Cost) / (Price - Salvage)
            </Text>
          </View>
          <Text style={s.body}>
            This represents the probability that demand should be less than or
            equal to the optimal order quantity. It balances the cost of
            ordering too many (overage cost) against the cost of ordering too
            few (underage cost).
          </Text>
          <Text style={s.h3}>Optimal Order Quantity</Text>
          <View style={s.formulaBox}>
            <Text style={s.formulaText}>
              {"Q* = mu + sigma * "}&Phi;{"^(-1)(CF)"}
            </Text>
          </View>
          <Text style={s.body}>
            Where &Phi;^(-1) is the inverse of the standard normal CDF
            (probit function). The setup summary displays both CF and Q* so
            you can verify your parameter choices produce a meaningful game.
          </Text>
          <Text style={s.h3}>Example</Text>
          <Text style={s.body}>
            With Price = $4.00, Cost = $0.50, Salvage = $0.00, Mean = 100,
            Sigma = 40:
          </Text>
          <Bullet>CF = (4.00 - 0.50) / (4.00 - 0.00) = 0.875</Bullet>
          <Bullet>
            Q* = 100 + 40 x 1.15 = 146 (approximately)
          </Bullet>
          <Text style={s.body}>
            This means the optimal strategy is to order about 146 croissants
            per day — well above the mean demand of 100, because the high
            profit margin makes it worth risking some leftovers.
          </Text>
          <GuideTip>
            Choose parameters where Q* differs meaningfully from the mean to
            create an interesting decision problem. If Q* equals the mean,
            students may not discover the value of the newsvendor model.
          </GuideTip>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 5: Control Room ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="The Host Control Room">
          <Text style={s.body}>
            Once a session is created, open the Host Control Room to manage
            gameplay in real time. The control room is your command center
            during a live session.
          </Text>
          <Text style={s.h3}>Session Header</Text>
          <Text style={s.body}>
            At the top you see the session code (share this with students), a
            progress bar showing how many days have been revealed, the current
            week, and the computed optimal Q*.
          </Text>
          <Text style={s.h3}>Training Phase</Text>
          <Text style={s.body}>
            When a session is first created, it is in the "training" state.
            Students can see the training data (demand histogram and time
            series). From here you can:
          </Text>
          <Bullet>
            Start Session: Transitions to the ordering phase and allows
            students to submit their first order.
          </Bullet>
          <Bullet>
            Redraw Distribution: Re-generates the random training data. Use
            this if the initial draw looks unrepresentative of the intended
            distribution.
          </Bullet>
          <Text style={s.h3}>Player Management</Text>
          <Text style={s.body}>
            The player list shows all students in the session with their
            submission status and cumulative profit:
          </Text>
          <Bullet>
            Nudge: Sends a toast notification to a specific player reminding
            them to submit their order. Useful for stragglers.
          </Bullet>
          <Bullet>
            Kick: Removes a player from the session entirely. Use sparingly —
            this cannot be undone.
          </Bullet>
          <Bullet>
            Finish Week: Auto-submits the mean demand as the order for any
            player who has not yet submitted, then advances to the reveal
            phase. This prevents one slow student from holding up the class.
          </Bullet>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 6: Reveal & Leaderboard ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Running the Reveal">
          <Text style={s.body}>
            In synchronous mode, once all students have submitted (or you use
            "Finish Week"), the session enters the reveal phase. Demand is
            revealed day by day with a short delay between each reveal for
            dramatic effect.
          </Text>
          <Text style={s.h3}>Auto-Reveal</Text>
          <Text style={s.body}>
            The reveal advances automatically with a 1.5-second delay between
            days. At the end of each week, it pauses and waits for new orders
            before continuing. You do not need to manually advance each day.
          </Text>
          <Text style={s.h3}>Leaderboard Toggle</Text>
          <Text style={s.body}>
            You can show or hide the leaderboard for students at any time
            using the toggle in the control room. Options include:
          </Text>
          <Bullet>
            Show during gameplay: Students see live rankings as they play,
            creating competitive motivation.
          </Bullet>
          <Bullet>
            Show only at the end: Hide the leaderboard during play and reveal
            it after the final week for a dramatic finish.
          </Bullet>
          <GuideTip>
            Hiding the leaderboard during play can reduce anchoring effects
            where students copy the strategy of top-ranked players.
          </GuideTip>
        </GuideSection>

        <GuideSection title="Demand Visualization (Host View)">
          <Text style={s.body}>
            The control room shows two charts visible only to you:
          </Text>
          <Text style={[s.body, s.bold]}>Demand Histogram</Text>
          <Text style={s.body}>
            Shows the distribution shape of the generated in-game demands,
            along with mean, standard deviation, skewness, and kurtosis.
            This helps you verify the generated data looks reasonable.
          </Text>
          <Text style={[s.body, s.bold]}>In-Game Payoff Curve</Text>
          <Text style={s.body}>
            A line chart showing total profit as a function of order quantity.
            It marks the theoretical optimal Q* and the best Q actually chosen
            by any student. This gives you a preview of how the endgame
            analysis will look.
          </Text>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 7: Ending & Export ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Ending a Session">
          <Text style={s.body}>
            You can end a session at any time using the "End Session" button.
            This can be done before all weeks are completed if needed (e.g.,
            running out of class time). When a session ends:
          </Text>
          <Bullet>
            All students see the "Game Complete" screen with their final rank
            and total profit.
          </Bullet>
          <Bullet>
            The leaderboard becomes visible to all students (if it was not
            already).
          </Bullet>
          <Bullet>
            Endgame charts are displayed showing how the group performed
            relative to the optimal strategy.
          </Bullet>
          <Text style={s.body}>
            Ended sessions appear in the "Completed Sessions" section of your
            Host Dashboard for future reference.
          </Text>
        </GuideSection>

        <GuideSection title="Data Export (CSV)">
          <Text style={s.body}>
            After a session ends, a "Download CSV" button becomes available.
            The exported file contains one row per player per day with the
            following columns:
          </Text>
          <GuideTable
            headers={["Column", "Description"]}
            rows={[
              ["sessionId", "Unique identifier for the session"],
              ["sessionCode", "The join code (e.g., GAME1)"],
              ["week", "Week number (1, 2, 3, ...)"],
              ["day", "Day within the week (1, 2, 3, ...)"],
              ["demand", "Actual demand for that day"],
              ["playerUid", "Unique identifier for the player"],
              ["playerName", "Player's display name"],
              ["orderQty", "Player's order quantity for that week"],
            ]}
          />
          <Text style={s.body}>
            Use this data for deeper analysis in Excel, R, Python, or any
            other tool. You can compute per-student profits, compare
            strategies, and create custom visualizations for debriefing.
          </Text>
        </GuideSection>

        <GuideSection title="Session Management">
          <Text style={s.body}>
            From the Host Dashboard, you can manage all your sessions:
          </Text>
          <Bullet>
            Open: Enter the control room for an active session.
          </Bullet>
          <Bullet>
            End: Finish a session that is still in progress.
          </Bullet>
          <Bullet>
            Delete: Permanently remove a finished session and its data.
          </Bullet>
        </GuideSection>
      </GuidePage>

      {/* ─── Page 8: Tips ─── */}
      <GuidePage guideName={GUIDE}>
        <GuideSection title="Tips for Effective Use">
          <Text style={s.h3}>Suggested Parameter Sets</Text>
          <GuideTable
            headers={["Scenario", "Price", "Cost", "Salvage", "Notes"]}
            rows={[
              [
                "High margin",
                "$4.00",
                "$0.50",
                "$0.00",
                "Q* well above mean — rewards ordering more",
              ],
              [
                "Low margin",
                "$2.00",
                "$1.50",
                "$0.00",
                "Q* near or below mean — rewards caution",
              ],
              [
                "With salvage",
                "$4.00",
                "$1.00",
                "$0.50",
                "Salvage reduces overage penalty",
              ],
              [
                "Symmetric",
                "$3.00",
                "$1.50",
                "$0.00",
                "Q* equals the mean — classic case",
              ],
            ]}
          />
          <Text style={s.h3}>Running a Live Session</Text>
          <NumItem n={1}>
            Share the session code on screen or via your LMS.
          </NumItem>
          <NumItem n={2}>
            Give students 2–3 minutes to review the training data before
            starting the first week.
          </NumItem>
          <NumItem n={3}>
            Use the nudge feature to keep the pace moving. If a few students
            are slow, use "Finish Week" to auto-submit for them.
          </NumItem>
          <NumItem n={4}>
            Consider hiding the leaderboard until the final reveal to prevent
            herding behavior.
          </NumItem>
          <NumItem n={5}>
            After the game, show the endgame charts and discuss: Why is Q*
            different from the mean? How did the group's average order compare?
          </NumItem>
          <Text style={s.h3}>Debrief Discussion Prompts</Text>
          <Bullet>
            What strategy did you use to decide your order quantity? Did it
            change over time?
          </Bullet>
          <Bullet>
            Why is the optimal order quantity different from the mean demand?
          </Bullet>
          <Bullet>
            How does the salvage value affect the optimal strategy?
          </Bullet>
          <Bullet>
            What real-world products face a similar newsvendor tradeoff?
          </Bullet>
          <Bullet>
            If you played again with different price parameters, how would you
            adjust your strategy?
          </Bullet>
          <GuideTip>
            Running the game twice with different parameters (e.g., high
            margin then low margin) can powerfully illustrate how the critical
            fractile shifts the optimal strategy.
          </GuideTip>
        </GuideSection>
      </GuidePage>
    </Document>
  );
}
