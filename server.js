const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PAYSTACK_URL = "https://api.paystack.co";
const FRONTEND_URL =
  "https://mercyjohn43210-rgb.github.io/Airtime-App/";

/* =========================================
   PAYSTACK HEADERS
========================================= */

function paystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json"
  };
}

/* =========================================
   HOME
========================================= */

app.get("/", (req, res) => {
  res.send("Johnmercy Backend is running");
});

/* =========================================
   INITIALIZE CARD / CHECKOUT PAYMENT
========================================= */

app.post("/initialize-payment", async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || amount === undefined) {
      return res.status(400).json({
        error: "Email and amount are required"
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 100
    ) {
      return res.status(400).json({
        error: "Minimum payment amount is ₦100"
      });
    }

    const response = await axios.post(
      `${PAYSTACK_URL}/transaction/initialize`,
      {
        email: email,
        amount: Math.round(numericAmount * 100),
        currency: "NGN",
        callback_url: FRONTEND_URL
      },
      {
        headers: paystackHeaders()
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error:
        error.response?.data?.message ||
        "Payment initialization failed"
    });
  }
});

/* =========================================
   VERIFY CARD / CHECKOUT PAYMENT
========================================= */

app.get("/verify-payment/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        error: "Payment reference is required"
      });
    }

    const response = await axios.get(
      `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(
        reference
      )}`,
      {
        headers: paystackHeaders()
      }
    );

    const payment = response.data;

    if (
      payment.status &&
      payment.data &&
      payment.data.status === "success"
    ) {
      return res.json({
        success: true,
        message: "Payment verified successfully",
        reference: payment.data.reference,
        amount: payment.data.amount / 100,
        currency: payment.data.currency,
        email:
          payment.data.customer?.email || null
      });
    }

    return res.json({
      success: false,
      message:
        "Payment has not been completed successfully."
    });

  } catch (error) {
    console.error(
      "Paystack verification error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error:
        error.response?.data?.message ||
        "Payment verification failed"
    });
  }
});

/* =========================================
   INITIALIZE PAY WITH TRANSFER
========================================= */

app.post("/initialize-transfer", async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || amount === undefined) {
      return res.status(400).json({
        error: "Email and amount are required"
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 100
    ) {
      return res.status(400).json({
        error: "Minimum payment amount is ₦100"
      });
    }

    /*
      Paystack requires an expiry time for
      Pay with Transfer.

      We use 30 minutes from now.
    */
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const response = await axios.post(
      `${PAYSTACK_URL}/charge`,
      {
        email: email,

        amount: Math.round(
          numericAmount * 100
        ),

        currency: "NGN",

        bank_transfer: {
          account_expires_at: expiresAt
        }
      },
      {
        headers: paystackHeaders()
      }
    );

    const data = response.data;

    /*
      Return only the information the frontend
      needs for the transfer screen.
    */

    if (data.status && data.data) {
      return res.json({
        status: true,
        message:
          data.message ||
          "Transfer account created",

        data: {
          reference:
            data.data.reference || null,

          status:
            data.data.status || null,

          amount:
            data.data.amount
              ? data.data.amount / 100
              : numericAmount,

          currency:
            data.data.currency || "NGN",

          display_text:
            data.data.display_text || null,

          account_number:
            data.data.bank_transfer?.account_number ||
            null,

          bank_name:
            data.data.bank_transfer?.bank_name ||
            null,

          account_name:
            data.data.bank_transfer?.account_name ||
            null,

          expires_at:
            data.data.bank_transfer?.account_expires_at ||
            expiresAt
        }
      });
    }

    return res.status(400).json({
      status: false,
      error:
        data.message ||
        "Transfer payment could not be initialized"
    });

  } catch (error) {
    console.error(
      "Paystack transfer initialization error:",
      error.response?.data || error.message
    );

    res.status(
      error.response?.status || 500
    ).json({
      status: false,
      error:
        error.response?.data?.message ||
        "Transfer payment initialization failed"
    });
  }
});

/* =========================================
   VERIFY TRANSFER PAYMENT
========================================= */

app.get(
  "/verify-transfer/:reference",
  async (req, res) => {
    try {
      const { reference } = req.params;

      if (!reference) {
        return res.status(400).json({
          error:
            "Transfer reference is required"
        });
      }

      const response = await axios.get(
        `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(
          reference
        )}`,
        {
          headers: paystackHeaders()
        }
      );

      const payment = response.data;

      if (
        payment.status &&
        payment.data
      ) {
        const transaction =
          payment.data;

        if (
          transaction.status ===
          "success"
        ) {
          return res.json({
            success: true,

            message:
              "Transfer payment verified successfully",

            reference:
              transaction.reference,

            amount:
              transaction.amount / 100,

            currency:
              transaction.currency,

            email:
              transaction.customer
                ?.email || null
          });
        }

        return res.json({
          success: false,

          status:
            transaction.status,

          message:
            "Transfer has not been completed yet."
        });
      }

      return res.json({
        success: false,
        message:
          "Transfer could not be verified."
      });

    } catch (error) {
      console.error(
        "Transfer verification error:",
        error.response?.data ||
          error.message
      );

      res.status(500).json({
        error:
          error.response?.data?.message ||
          "Transfer verification failed"
      });
    }
  }
);

/* =========================================
   PAYSTACK WEBHOOK
========================================= */

app.post("/paystack-webhook", (req, res) => {
  try {
    const event = req.body;

    console.log(
      "Paystack webhook received:",
      event.event
    );

    /*
      For now we acknowledge the webhook.

      IMPORTANT:
      A production wallet should store successful
      references in a database and credit the user's
      server-side wallet exactly once.
    */

    if (
      event.event ===
      "charge.success"
    ) {
      console.log(
        "Successful Paystack transaction:",
        event.data?.reference
      );
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error(
      "Webhook error:",
      error.message
    );

    return res.sendStatus(200);
  }
});

/* =========================================
   SERVER
========================================= */

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Johnmercy Backend running on port ${PORT}`
  );
});
