import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { CloudBillingClient } from "@google-cloud/billing";

interface BudgetNotification {
  budgetDisplayName?: string;
  costAmount?: number;
  budgetAmount?: number;
  currencyCode?: string;
  alertThresholdExceeded?: number;
  forecastThresholdExceeded?: number;
}

const billing = new CloudBillingClient();

export const billingKillSwitch = onMessagePublished<BudgetNotification>(
  "billing-kill-switch",
  async (event) => {
    const data = event.data.message.json;

    if (!data || typeof data !== "object") {
      console.warn("[killSwitch] No JSON payload in message; skipping.");
      return;
    }

    const { costAmount, budgetAmount, budgetDisplayName, currencyCode } = data;

    if (typeof costAmount !== "number" || typeof budgetAmount !== "number") {
      console.warn("[killSwitch] Missing costAmount or budgetAmount.", data);
      return;
    }

    if (costAmount <= budgetAmount) {
      console.log(
        `[killSwitch] Under budget (${costAmount} ${currencyCode ?? ""} <= ${budgetAmount}) for "${budgetDisplayName ?? "?"}"; no action.`
      );
      return;
    }

    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
      throw new Error("[killSwitch] GCLOUD_PROJECT is not set.");
    }
    const projectName = `projects/${projectId}`;

    const [billingInfo] = await billing.getProjectBillingInfo({ name: projectName });
    if (!billingInfo.billingEnabled) {
      console.log(`[killSwitch] Billing already disabled on ${projectName}; no action.`);
      return;
    }

    console.warn(
      `[killSwitch] DISABLING BILLING on ${projectName}: cost ${costAmount} ${currencyCode ?? ""} > budget ${budgetAmount} ("${budgetDisplayName ?? "?"}").`
    );

    const [result] = await billing.updateProjectBillingInfo({
      name: projectName,
      projectBillingInfo: { billingAccountName: "" },
    });

    console.warn(`[killSwitch] Billing disabled. Result: ${JSON.stringify(result)}`);
  }
);
