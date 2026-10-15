// Manual-payment launch mode.
//
// Until a payment gateway (e.g. DPO Pay for cards, MyZakaPay / Orange Money
// merchant APIs for mobile money) is approved and integrated, customers pay by
// sending money using the order reference, and staff confirm receipt in the
// admin screen. The "how to pay" text for each method comes from environment
// variables so real account numbers never live in the source code:
//
//   PAY_EFT_DETAILS           e.g. "Bank: ...\nAccount name: ...\nAccount no: ...\nBranch: ..."
//   PAY_ORANGE_MONEY_DETAILS  e.g. "Send to Orange Money number 7X XXX XXX (Mok Transports)"
//   PAY_MYZAKA_DETAILS        e.g. "Send to MyZaka merchant number ..."
//
// If a variable isn't set, customers see a neutral "we'll send you the
// details" message instead of anything made up.

export const PAYMENT_METHODS = {
  "Bank transfer (EFT)": "PAY_EFT_DETAILS",
  "Orange Money Botswana": "PAY_ORANGE_MONEY_DETAILS",
  "Mascom MyZaka": "PAY_MYZAKA_DETAILS",
};

export function isSupportedMethod(method) {
  return Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, method);
}

export function paymentInstructionsFor(method) {
  const key = PAYMENT_METHODS[method];
  const text = key && process.env[key];
  return text && text.trim()
    ? text.replace(/\\n/g, "\n")
    : "Mok Transports will send you the payment details for this method shortly. Keep your order reference handy.";
}



