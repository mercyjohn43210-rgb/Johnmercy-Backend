require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const app = express();
/* =========================
   MIDDLEWARE
========================= */
app.use(cors({
  origin: '*'
}));
app.use(express.json());
/* =========================
   ENVIRONMENT VARIABLES
========================= */
const SUPABASE_URL =
  process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_KEY;
const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'https://mercyjohn43210-rgb.github.io/Airtime-App/';
const PAYSTACK_BASE_URL =
  'https://api.paystack.co';
const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
/* =========================
   HELPER FUNCTIONS
========================= */
function generateReference(prefix = 'JM') {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
}
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}
function validAmount(amount) {
  return (
    Number.isFinite(Number(amount)) &&
    Number(amount) > 0
  );
}
/* =========================
   DATA PLANS
========================= */
/*
   4 NETWORKS
   × 3 CATEGORIES
   × 8 PLANS
   = 96 PLANS
*/
const networks = [
  'MTN',
  'Airtel',
  'Glo',
  '9mobile'
];
const categories = [
  'Regular',
  'Gift',
  'Corporate'
];
const planTemplates = [
  {
    amount: 100,
    size: '100MB',
    validity: '1 day'
  },
  {
    amount: 200,
    size: '250MB',
    validity: '3 days'
  },
  {
    amount: 500,
    size: '1GB',
    validity: '7 days'
  },
  {
    amount: 1000,
    size: '2GB',
    validity: '30 days'
  },
  {
    amount: 2000,
    size: '5GB',
    validity: '30 days'
  },
  {
    amount: 3000,
    size: '10GB',
    validity: '30 days'
  },
  {
    amount: 5000,
    size: '20GB',
    validity: '30 days'
  },
  {
    amount: 10000,
    size: '40GB',
    validity: '30 days'
  }
];
const DATA_PLANS = [];
networks.forEach(network => {
  categories.forEach(category => {
    planTemplates.forEach(plan => {
      const networkKey =
        network
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      const categoryKey =
        category.toLowerCase();
      DATA_PLANS.push({
        id:
          `${networkKey}-${categoryKey}-${plan.amount}`,
        network,
        category,
        amount:
          plan.amount,
        size:
          plan.size,
        validity:
          plan.validity
      });
    });
  });
});
/* =========================
   HOME
========================= */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message:
      'Johnmercy Backend is running',
    dataPlans:
      DATA_PLANS.length
  });
});
/* =========================
   TEST SUPABASE
========================= */
app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } =
      await supabase
        .from('users')
        .select('*')
        .limit(20);
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    res.json({
      success: true,
      users: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* =========================
   GET DATA PLANS
========================= */
app.get('/data', (req, res) => {
  try {
    const network =
      req.query.network;
    const category =
      req.query.category;
    let plans =
      [...DATA_PLANS];
    if (network) {
      plans =
        plans.filter(
          plan =>
            plan.network.toLowerCase() ===
            String(network).toLowerCase()
        );
    }
    if (category) {
      plans =
        plans.filter(
          plan =>
            plan.category.toLowerCase() ===
            String(category).toLowerCase()
        );
    }
    res.json({
      success: true,
      count:
        plans.length,
      plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* =========================
   GET WALLET
========================= */
app.get('/wallet/:email', async (req, res) => {
  try {
    const email =
      normalizeEmail(
        req.params.email
      );
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    const { data, error } =
      await supabase
        .from('wallets')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    if (!data) {
      return res.json({
        success: true,
        wallet: {
          email,
          balance: 0
        }
      });
    }
    res.json({
      success: true,
      wallet: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* =========================
   CREATE WALLET
========================= */
app.post('/wallet/create', async (req, res) => {
  try {
    const email =
      normalizeEmail(
        req.body.email
      );
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    const {
      data: existing,
      error: existingError
    } =
      await supabase
        .from('wallets')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    if (existingError) {
      return res.status(500).json({
        success: false,
        error: existingError.message
      });
    }
    if (existing) {
      return res.json({
        success: true,
        wallet: existing
      });
    }
    const {
      data,
      error
    } =
      await supabase
        .from('wallets')
        .insert([
          {
            email,
            balance: 0
          }
        ])
        .select()
        .single();
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    res.json({
      success: true,
      wallet: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* =========================
   SIGN UP
========================= */
app.post('/users', async (req, res) => {
  try {
    const name =
      String(
        req.body.name || ''
      ).trim();
    const email =
      normalizeEmail(
        req.body.email
      );
    const password =
      String(
        req.body.password || ''
      );
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error:
          'Name, email and password are required'
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error:
          'Password must be at least 6 characters'
      });
    }
    const {
      data: existing,
      error: existingError
    } =
      await supabase
        .from('users')
        .select('id,email')
        .eq('email', email)
        .maybeSingle();
    if (existingError) {
      return res.status(500).json({
        success: false,
        error: existingError.message
      });
    }
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }
    const password_hash =
      await bcrypt.hash(
        password,
        10
      );
    const {
      data: user,
      error
    } =
      await supabase
        .from('users')
        .insert([
          {
            name,
            email,
            password_hash
          }
        ])
        .select(
          'id,name,email,created_at'
        )
        .single();
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    await supabase
      .from('wallets')
      .insert([
        {
          email,
          balance: 0
        }
      ]);
    res.json({
      success: true,
      user,
      wallet: {
        email,
        balance: 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* =========================
   LOGIN
========================= */
app.post('/login', async (req, res) => {
  try {
    const email =
      normalizeEmail(
        req.body.email
      );
    const password =
      String(
        req.body.password || ''
      );
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error:
          'Email and password are required'
      });
    }
    const {
      data: user,
      error
    } =
      await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        error:
          'Invalid email or password'
      });
    }
    const passwordOk =
      await bcrypt.compare(
        password,
        user.password_hash
      );
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        error:
          'Invalid email or password'
      });
    }
    const {
      data: wallet
    } =
      await supabase
        .from('wallets')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      wallet:
        wallet || {
          email,
          balance: 0
        }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/* =========================
   INITIALIZE PAYSTACK PAYMENT
========================= */
app.post(
  '/initialize-payment',
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );
      const amount =
        Number(
          req.body.amount
        );
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }
      if (!validAmount(amount)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount'
        });
      }
      if (amount < 100) {
        return res.status(400).json({
          success: false,
          error:
            'Minimum funding amount is ₦100'
        });
      }
      if (!PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error:
            'Paystack secret key is not configured'
        });
      }
      const reference =
        generateReference(
          'FUND'
        );
      const response =
        await axios.post(
          `${PAYSTACK_BASE_URL}/transaction/initialize`,
          {
            email,
            amount:
              Math.round(
                amount * 100
              ),
            reference,
            callback_url:
              FRONTEND_URL
          },
          {
            headers: {
              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type':
                'application/json'
            }
          }
        );
      res.json({
        success: true,
        reference,
        status:
          response.data.status,
        data:
          response.data.data,
        authorization_url:
          response.data.data.authorization_url,
        access_code:
          response.data.data.access_code
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error.response?.data?.message ||
          error.message
      });
    }
  }
);
/* =========================
   VERIFY PAYSTACK PAYMENT
========================= */
app.get(
  '/verify-payment/:reference',
  async (req, res) => {
    try {
      const reference =
        req.params.reference;
      if (!PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error:
            'Paystack secret key is not configured'
        });
      }
      const response =
        await axios.get(
          `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
          {
            headers: {
              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`
            }
          }
        );
      const payment =
        response.data.data;
      if (
        payment.status !==
        'success'
      ) {
        return res.json({
          success: false,
          status:
            payment.status,
          message:
            'Payment not successful'
        });
      }
      const email =
        normalizeEmail(
          payment.customer?.email
        );
      const amount =
        Number(
          payment.amount || 0
        ) / 100;
      if (!email || amount <= 0) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid payment information'
        });
      }
      const {
        data: wallet,
        error: walletError
      } =
        await supabase
          .from('wallets')
          .select('*')
          .eq('email', email)
          .maybeSingle();
      if (walletError) {
        return res.status(500).json({
          success: false,
          error: walletError.message
        });
      }
      let newBalance;
      if (!wallet) {
        const {
          data: createdWallet,
          error
        } =
          await supabase
            .from('wallets')
            .insert([
              {
                email,
                balance: amount
              }
            ])
            .select()
            .single();
        if (error) {
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        newBalance =
          Number(
            createdWallet.balance
          );
      } else {
        newBalance =
          Number(
            wallet.balance || 0
          ) + amount;
        const {
          error
        } =
          await supabase
            .from('wallets')
            .update({
              balance:
                newBalance,
              updated_at:
                new Date().toISOString()
            })
            .eq(
              'email',
              email
            );
        if (error) {
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
      try {
        await supabase
          .from('wallet_transactions')
          .insert([
            {
              reference,
              email,
              type:
                'credit',
              amount
            }
          ]);
      } catch (transactionError) {
        console.log(
          'Transaction save error:',
          transactionError.message
        );
      }
      res.json({
        success: true,
        status:
          'success',
        reference,
        email,
        amount,
        wallet: {
          email,
          balance:
            newBalance
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error.response?.data?.message ||
          error.message
      });
    }
  }
);
/* =========================
   INITIALIZE BANK TRANSFER
========================= */
app.post(
  '/initialize-transfer',
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );
      const amount =
        Number(
          req.body.amount
        );
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }
      if (!validAmount(amount)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount'
        });
      }
      if (!PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error:
            'Paystack secret key is not configured'
        });
      }
      const reference =
        generateReference(
          'TRF'
        );
      const response =
        await axios.post(
          `${PAYSTACK_BASE_URL}/charge`,
          {
            email,
            amount:
              Math.round(
                amount * 100
              ),
            reference,
            bank_transfer: {}
          },
          {
            headers: {
              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type':
                'application/json'
            }
          }
        );
      res.json({
        success: true,
        reference,
        status:
          response.data.status,
        data:
          response.data.data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error.response?.data?.message ||
          error.message
      });
    }
  }
);
/* =========================
   VERIFY BANK TRANSFER
========================= */
app.get(
  '/verify-transfer/:reference',
  async (req, res) => {
    try {
      const reference =
        req.params.reference;
      if (!PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error:
            'Paystack secret key is not configured'
        });
      }
      const response =
        await axios.get(
          `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
          {
            headers: {
              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`
            }
          }
        );
      const payment =
        response.data.data;
      const status =
        payment.status;
      const amount =
        Number(
          payment.amount || 0
        ) / 100;
      const email =
        normalizeEmail(
          payment.customer?.email
        );
      if (
        status !== 'success'
      ) {
        return res.json({
          success: false,
          status,
          reference,
          amount,
          email
        });
      }
      if (!email || amount <= 0) {
        return res.json({
          success: false,
          status,
          reference,
          amount,
          error:
            'Invalid transfer information'
        });
      }
      const {
        data: wallet,
        error: walletError
      } =
        await supabase
          .from('wallets')
          .select('*')
          .eq('email', email)
          .maybeSingle();
      if (walletError) {
        return res.status(500).json({
          success: false,
          error: walletError.message
        });
      }
      let newBalance;
      if (!wallet) {
        const {
          data: created,
          error
        } =
          await supabase
            .from('wallets')
            .insert([
              {
                email,
                balance:
                  amount
              }
            ])
            .select()
            .single();
        if (error) {
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
        newBalance =
          Number(
            created.balance
          );
      } else {
        newBalance =
          Number(
            wallet.balance || 0
          ) + amount;
        const {
          error
        } =
          await supabase
            .from('wallets')
            .update({
              balance:
                newBalance,
              updated_at:
                new Date().toISOString()
            })
            .eq(
              'email',
              email
            );
        if (error) {
          return res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
      try {
        await supabase
          .from('wallet_transactions')
          .insert([
            {
              reference,
              email,
              type:
                'bank_transfer_credit',
              amount
            }
          ]);
      } catch (transactionError) {
        console.log(
          'Transfer transaction save error:',
          transactionError.message
        );
      }
      res.json({
        success: true,
        status:
          'success',
        reference,
        amount,
        email,
        wallet: {
          email,
          balance:
            newBalance
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error.response?.data?.message ||
          error.message
      });
    }
  }
);
/* =========================
   PURCHASE DATA
========================= */
app.post(
  '/purchase-data',
  async (req, res) => {
    try {
      const email =
        normalizeEmail(
          req.body.email
        );
      const phone =
        String(
          req.body.phone || ''
        ).trim();
      const planId =
        String(
          req.body.planId || ''
        ).trim();
      if (
        !email ||
        !phone ||
        !planId
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Email, phone number and plan are required'
        });
      }
      const plan =
        DATA_PLANS.find(
          p =>
            p.id === planId
        );
      if (!plan) {
        return res.status(404).json({
          success: false,
          error:
            'Data plan not found'
        });
      }
      const {
        data: wallet,
        error: walletError
      } =
        await supabase
          .from('wallets')
          .select('*')
          .eq('email', email)
          .maybeSingle();
      if (walletError) {
        return res.status(500).json({
          success: false,
          error: walletError.message
        });
      }
      if (!wallet) {
        return res.status(404).json({
          success: false,
          error:
            'Wallet not found'
        });
      }
      const balance =
        Number(
          wallet.balance || 0
        );
      if (
        balance <
        plan.amount
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Insufficient wallet balance',
          balance,
          required:
            plan.amount
        });
      }
      const newBalance =
        balance -
        plan.amount;
      const reference =
        generateReference(
          'DATA'
        );
      const {
        error: updateError
      } =
        await supabase
          .from('wallets')
          .update({
            balance:
              newBalance,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            'email',
            email
          );
      if (updateError) {
        return res.status(500).json({
          success: false,
          error:
            updateError.message
        });
      }
      try {
        await supabase
          .from('wallet_transactions')
          .insert([
            {
              reference,
              email,
              type:
                'data_purchase',
              amount:
                plan.amount
            }
          ]);
      } catch (transactionError) {
        console.log(
          'Transaction save error:',
          transactionError.message
        );
      }
      res.json({
        success: true,
        message:
          'Data purchase accepted',
        reference,
        phone,
        plan,
        wallet: {
          email,
          balance:
            newBalance
        },
        deliveryStatus:
          'pending_provider'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
/* =========================
   PAYSTACK WEBHOOK
========================= */
app.post(
  '/paystack-webhook',
  express.raw({
    type: 'application/json'
  }),
  async (req, res) => {
    try {
      if (!PAYSTACK_SECRET_KEY) {
        return res.sendStatus(200);
      }
      const signature =
        req.headers[
          'x-paystack-signature'
        ];
      const hash =
        crypto
          .createHmac(
            'sha512',
            PAYSTACK_SECRET_KEY
          )
          .update(req.body)
          .digest('hex');
      if (
        signature !== hash
      ) {
        return res.sendStatus(401);
      }
      const event =
        JSON.parse(
          req.body.toString()
        );
      console.log(
        'Paystack webhook:',
        event.event
      );
      res.sendStatus(200);
    } catch (error) {
      console.log(
        'Webhook error:',
        error.message
      );
      res.sendStatus(200);
    }
  }
);
/* =========================
   404 HANDLER
========================= */
app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        'Route not found',
      path:
        req.path
    });
  }
);
/* =========================
   START SERVER
========================= */
const PORT =
  process.env.PORT || 3000;
app.listen(
  PORT,
  () => {
    console.log(
      `Johnmercy Backend running on port ${PORT}`
    );
    console.log(
      `Total data plans: ${DATA_PLANS.length}`
    );
  }
);
