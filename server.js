const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripePublicKey = process.env.STRIPE_PUBLIC_KEY
const express = require("express");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
require("dotenv").config();
const app = express();
const fs = require('fs')
const stripe = require('stripe')(stripeSecretKey)

const initializePassport = require("./passportConfig");

initializePassport(passport);

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(flash());
// Parses details from a form
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

app.use(
  session({
    // Key we want to keep secret which will encrypt all of our information
    secret: process.env.SESSION_SECRET,
    // Should we resave our session variables if nothing has changes which we dont
    resave: false,
    // Save empty value if there is no vaue which we do not want to do
    saveUninitialized: false
  })
);
// Funtion inside passport which initializes passport
app.use(passport.initialize());
// Store our variables to be persisted across the whole session. Works with app.use(Session) above
app.use(passport.session());
app.use(flash());

app.get("/", (req, res) => {
  res.render("home", {
    user: req.user
  })
});

app.get("/users/register", checkAuthenticated, (req, res) => {
  res.render("register.ejs", {
    user: req.user
  });
});

app.get("/users/login", checkAuthenticated, (req, res) => {
  // flash sets a messages variable. passport sets the error message
  // console.log(req.session.flash.error);
  


  res.render("login.ejs", {
    user: req.user,
    message: req.session.flash.error
  });
});

app.get("/users/dashboard", checkNotAuthenticated, (req, res) => {
  console.log(req.isAuthenticated());
  res.render("dashboard", {
    user: req.user
  });
});

app.get("/users/logout", (req, res) => {
  req.logout();
  res.render("home", { message: "You have logged out successfully" });
});

app.get('/store', function(req, res) {
    fs.readFile('items.json', function(error, data) {
        if (error) {
            res.status(500).end()
        } else {
            res.render('store.ejs', {
                stripePublicKey: stripePublicKey,
                items:JSON.parse(data),
                user: req.user
            })
        }
    })
})
app.get('/logs', function(req, res) {
    fs.readFile('log.json', function(error, data) {
        if (error) {
            res.status(500).end()
        } else {
            res.render('logs.ejs', {
                log:JSON.parse(data),
                user: req.user
            })
        }
    })
})

app.post("/users/register", async (req, res) => {
  let { name, email, password, password2 } = req.body;

  let errors = [];

  console.log({
    name,
    email,
    password,
    password2
  });

  if (!name || !email || !password || !password2) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("register", { 
      errors,
      name,
      email,
      password,
      password2,
      user: req.user });
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
    // Validation passed
    pool.query(
      `SELECT * FROM users
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.log(err);
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          return res.render("register", {
            message: "Email already registered",
            user: req.user
          });
        } else {
          pool.query(
            `INSERT INTO users (name, email, password)
                VALUES ($1, $2, $3)
                RETURNING id, password`,
            [name, email, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash("success_msg", "You are now registered. Please log in");
              res.redirect("/users/login");
            }
          );
        }
      }
    );
  }
});

app.post('/purchase', function(req, res) {
    fs.readFile('items.json', function(error, data) {
        if (error) {
            console.error(error)
            res.status(500).end()
        } else {
            const itemsJson = JSON.parse(data)
            const itemsArray = itemsJson.items
            let total = 0
            req.body.items.forEach(function(item) {
                const itemJson = itemsArray.find(function(i) {
                    return i.id == item.id
                })
                total = total + itemJson.price * item.quantity
            })
            stripe.charges.create({
                amount: total,
                source: req.body.stripeTokenId,
                currency: 'usd'
            }).then(function() {
                res.json({ message: 'Successfully purchased items' })
            }).catch(function() {
                res.status(500).end()
            })
        }
    })
})

app.post(
  "/users/login",
  passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
  })
);

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/users/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/users/login");
}

app.listen(3000)
