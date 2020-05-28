const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");

function initialize(passport) {
  console.log("Initialized");

  const authenticateUser = function(email, password, done) {
    console.log(email, password);
    pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
      function(err, results) {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          const user = results.rows[0];

          bcrypt.compare(password, user.password, function(err, isMatch) {
            console.log(password, user.password)
            if (err) {
              console.log(err);
            }
            if (isMatch) {
              console.log("match")
              return done(null, user);
            } else {
              //password is incorrect
              console.log("password was entered incorrectly")
              return done(null, false, { message: "Password or email address is incorrect" });
            }
          });
        } else {
          console.log("Invalid email address")
          // No user
          return done(null, false, {
            message: "Password or email address is incorrect"
          });
        }
      }
    );
  };

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      authenticateUser
    )
  );
  // Stores user details inside session. serializeUser determines which data of the user
  // object should be stored in the session. The result of the serializeUser method is attached
  // to the session as req.session.passport.user = {}. Here for instance, it would be (as we provide
  //   the user id as the key) req.session.passport.user = {id: 'xyz'}
  passport.serializeUser(function(user, done) {
    done(null, user.id)
  });

  // In deserializeUser that key is matched with the in memory array / database or any data resource.
  // The fetched object is attached to the request object as req.user

  passport.deserializeUser(function(id, done) {
    pool.query(`SELECT * FROM users WHERE id = $1`, [id], function(err, results) {
      if (err) {
        return done(err);
      }
      console.log(`ID is ${results.rows[0].id}`);
      return done(null, results.rows[0]);
    });
  });
}

module.exports = initialize;