require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const cors = require('cors');
app.use(cors({
  origin: "*",
  credentials: true
}));

const { ObjectId } = require('mongodb');
const connectDB = require('./db');

connectDB();

// ---------------- ROOT ----------------
app.get('/', (req, res) => {
  res.send('Server is working');
});

// ---------------- USERS ----------------
app.post('/users', async (req, res) => {
  const db = await connectDB();

  await db.collection('users').insertOne({
    name: req.body.name,
    balance: 0
  });

  res.send('User added');
});

app.get('/users', async (req, res) => {
  const db = await connectDB();
  const users = await db.collection('users').find().toArray();
  res.json(users);
});

app.delete('/users/:name', async (req, res) => {
  const db = await connectDB();
  const name = req.params.name;

  await db.collection('users').deleteOne({ name });

  await db.collection('expenses').updateMany(
    {},
    { $pull: { participants: name } }
  );

  res.send('User deleted');
});

// ---------------- EXPENSES ----------------
app.post('/expenses', async (req, res) => {
  const db = await connectDB();

  const { title, amount, paidBy, participants } = req.body;

  const expense = {
    title,
    amount,
    paidBy,
    participants
  };

  const result = await db.collection('expenses').insertOne(expense);

  const share = amount / participants.length;

  for (let user of participants) {
    if (user === paidBy) {
      await db.collection('users').updateOne(
        { name: user },
        { $inc: { balance: amount - share } }
      );
    } else {
      await db.collection('users').updateOne(
        { name: user },
        { $inc: { balance: -share } }
      );
    }
  }

  res.send('Expense added');
});

app.get('/expenses', async (req, res) => {
  const db = await connectDB();
  const expenses = await db.collection('expenses').find().toArray();
  res.json(expenses);
});

// ---------------- DELETE EXPENSE (FIXED) ----------------
app.delete('/expenses/:id', async (req, res) => {
  const db = await connectDB();

  const id = req.params.id;

  const expense = await db.collection('expenses').findOne({
    _id: new ObjectId(id)
  });

  if (!expense) {
    return res.status(404).send('Expense not found');
  }

  const share = expense.amount / expense.participants.length;

  for (let user of expense.participants) {
    if (user === expense.paidBy) {
      await db.collection('users').updateOne(
        { name: user },
        { $inc: { balance: -(expense.amount - share) } }
      );
    } else {
      await db.collection('users').updateOne(
        { name: user },
        { $inc: { balance: share } }
      );
    }
  }

  await db.collection('expenses').deleteOne({
    _id: new ObjectId(id)
  });

  res.send('Expense deleted + balances corrected');
});

// ---------------- BALANCES ----------------
app.get('/balances', async (req, res) => {
  const db = await connectDB();
  const users = await db.collection('users').find().toArray();

  res.json(users.map(u => ({
    name: u.name,
    balance: u.balance
  })));
});

// ---------------- SETTLEMENTS ----------------
app.get('/settlements', async (req, res) => {
  const db = await connectDB();
  const users = await db.collection('users').find().toArray();

  let creditors = [];
  let debtors = [];

  users.forEach(u => {
    if (u.balance > 0) {
      creditors.push({ name: u.name, amount: u.balance });
    } else if (u.balance < 0) {
      debtors.push({ name: u.name, amount: -u.balance });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let i = 0, j = 0;
  let result = [];

  while (i < debtors.length && j < creditors.length) {
    let d = debtors[i];
    let c = creditors[j];

    let amount = Math.min(d.amount, c.amount);

    result.push({
      from: d.name,
      to: c.name,
      amount
    });

    d.amount -= amount;
    c.amount -= amount;

    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }

  res.json(result);
});

// ---------------- SERVER ----------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});