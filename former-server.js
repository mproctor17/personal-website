if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripePublicKey = process.env.STRIPE_PUBLIC_KEY
const sessionSecret = process.env.SESSION_SECRET

const express = require('express')
const app = express()
const fs = require('fs')
const stripe = require('stripe')(stripeSecretKey)
const { pool } = require("./dbConfig")
const bcrypt = require('bcrypt')
const session = require('express-session')
const passport = require("passport")
const flash = require('express-flash')
const initializePassport = require("./passportConfig")

initializePassport(passport)

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(flash())
app.use(express.static('public'))
app.use(express.urlencoded({extended: false}))
app.use(passport.initialize())
app.use(passport.session())
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false
}))

app.get('/', function(req, res) {
    res.render('home.ejs', { user: req.user })
})

app.get('/login', checkAuthenticated, function(req, res) {
    // console.log(req.session.flash.error)
    res.render("login.ejs", { user: req.user }
    )
})

  app.get('/register', checkAuthenticated, (req, res) => {
    res.render("register.ejs", { user: req.user })
})

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

app.get("/logout", (req, res) => {
    req.logout()
    res.render("index", { message: "You have logged out successfully" })
})

app.get("/dashboard", checkNotAuthenticated, (req, res) => {
    console.log(req.isAuthenticated())
    res.render("dashboard.ejs", { user: req.user.name })
  })

app.post('/login', 
    passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true
  })
)

app.post('/register', async function(req, res) {
    let { name, email, password, password2 } = req.body
    
    console.log({
        name,
        email,
        password,
        password2
    })

    let errors = []

    if (!name || !email || !password || !password2) {
        errors.push({message: "Please enter all fields"})
    }

    if (password.length < 6) {
        errors.push({message: "Password should be at least 6 characters"})

    }

    if (password != password2) {
        errors.push({message: "Passwords do not match"})

    }

    if (errors.length > 0) {
        res.render('register.ejs', { user: req.user, errors })
    } else {
        let hashedPassword = await bcrypt.hash(password, 10)
        console.log(hashedPassword)

        pool.query(
            `SELECT * FROM users
            WHERE email = $1`,
            [email],
            function(err, results) {
                if (err) {
                    console.log(error)
                }
                console.log(results.rows)

                if (results.rows.length > 0) {
                    return res.render('register.ejs', { 
                        message: "Email address already registered",
                        user: req.user
                     })
                } else {
                    pool.query(
                        `INSERT INTO users (name, email, password)
                        VALUES ($1, $2, $3)
                        RETURNING id, password`,
                        [name, email, hashedPassword],
                        function(err, results) {
                            if (err) {
                                throw err
                            }
                            console.log(results.rows)
                            req.flash('success_msg', "You are now registered. Please log in")
                            res.redirect("/login")
                        }
                    )
                }
            }
        )
    }
})

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

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect("/dashboard")
    }
    next()
  }
  
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }
    res.redirect("/login")
}

app.listen(3000)