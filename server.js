const DATA_PLANS = [];
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
const plans = [
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
networks.forEach(network => {
  categories.forEach(category => {
    plans.forEach(plan => {
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
