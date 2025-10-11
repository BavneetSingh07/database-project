const ejs = require('ejs');
const express = require('express');
const mysql = require('mysql2')
const session = require('express-session');
const Decimal = require ('decimal.js');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');

const saltRounds = 10;

require('dotenv').config();

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

function ToNullable (value){
  if (value === '') {
    return null;
  } else {
    return value;
  }
}

function NumberToNullable (value){
  if (value === '') {
    return null;
  } else {
    return Number(value);
  }
}

function DecimalToNullable (value){
  if (value === '') {
    return null;
  } else {
    return Decimal(value).toFixed(1);
  }
}

app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  }

  next();
})

const db = mysql.createConnection({
  host:process.env.DB_HOST,
  user:process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  dateStrings: true
});

db.connect((err) =>{
  if (err) {
    console.error('Database Connection Unsuccesful');
  } else {
    console.log('database connected successfully');
  }
  
});

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/static'));

app.use(express.urlencoded({extended: true}));

app.get('/', (req, res) => {
  res.render('index');
})

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req,res) =>{
  console.log(req.body);
  const {username} = req.body;
  const {password} = req.body;
  db.query('SELECT * FROM login WHERE username = ?', [username], (err, results) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log("RESULT:", results);
    if (results[0]){
      const hashedPassword = results[0].password;
      bcrypt.compare(password, hashedPassword, (err, result) => {
        if (err){
          res.status(500).send("Internal Server Error");
          return console.error(err.message);
        }
        if (result){
          req.session.userId = results[0].id;
          db.query('UPDATE login SET last_logged_in = NOW() WHERE id = ?', [req.session.userId], (err, res2) =>{
            if (err){
              res.status(500).send("Internal Server Error");
              return console.error(err.message);
            }
            console.log(res2);
            req.flash('success', 'Logged In Successfully');
            res.redirect('/dashboard')
          })
        } else {
          req.flash('error', 'Username or Password Incorrect')
          res.redirect('/login')
        }
      })
    } else {
      req.flash('error','Username or Password Incorrect')
      res.redirect('/login');
    }
  })
})

const checkUserLoggedIn = (req, res, next) => {
  if (!req.session.userId){
    return res.redirect('/login');
  }

  next();
};

app.get('/logout', (req, res) => {
  req.session.userId = null;
  req.flash('success', 'Logged Out Successfully');
  res.redirect('/login');
  console.log('LOGGED OUT');
})

app.get('/update', checkUserLoggedIn, (req,res) =>{
  db.query('SELECT * from userInfo where id = ?', [req.session.userId], (err, results) =>{
    if (err) {
      res.status(500).send("Internal Server Error");
      return console.error (err.message);
    }
    console.log(results[0])
    res.render ('update', {
      user: results[0]
    })
  })
})

app.post('/update', (req, res) => {
  let dob;
  if (!req.body.date_of_birth || req.body.date_of_birth == "0"){
    dob = null;
  } else {
    dob = req.body.date_of_birth;
  }
  db.query ('UPDATE userInfo SET first_name = ?, last_name = ?, date_of_birth = ?, email = ?, address = ? WHERE id = ?',
    [req.body.first_name, req.body.last_name, dob, req.body.email, req.body.address, req.session.userId], 
    (err, results) => {
      if (err) {
        res.status(500).send("Internal Server Error");
        return console.error(err.message);
      }
      req.flash('success', 'Updated User Information Successfully')
      res.redirect('/dashboard');
    })
})

app.get('/delete', checkUserLoggedIn, (req, res) => {
  res.render('delete');
})

app.post('/delete', (req,res) => {
  console.log(req.body);
  const choice = req.body.confirm;

  if (choice == "no"){
    return res.redirect('/dashboard');
  }
  if (choice == "yes"){
    db.query('DELETE FROM recipes WHERE user_id = ?', [req.session.userId], (err, results) => {
      if (err) {
        res.status(500).send("Internal Server Error");
        return console.error (err.message);
      }
      console.log("DELETE FROM RECIPES TABLE: ", results);
    })
    db.query('DELETE FROM userInfo WHERE id = ?', [req.session.userId], (err, results) => {
      if (err) {
        res.status(500).send("Internal Server Error");
        return console.error (err.message);
      }
      console.log("DELETE FROM USERINFO TABLE: ", results);
    })
    db.query('DELETE FROM login WHERE id = ?', [req.session.userId], (err, results) => {
      if (err) {
        res.status(500).send("Internal Server Error");
        return console.error (err.message);
      }
      console.log("DELETE FROM LOGIN TABLE: ", results);
    })
    req.session.userId = null;
    req.flash('success', 'Account Deleted Succesfully')
    res.redirect('/login');
  }
})

app.get('/dashboard', checkUserLoggedIn, (req, res) => {
  db.query('SELECT COUNT(*) FROM recipes WHERE user_id = ?', [req.session.userId], (err, res1) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log("TOTAL RECIPES:", res1);
    db.query('SELECT COUNT(*) FROM recipes WHERE favourite = 1 and user_id = ?', [req.session.userId], (err,res2) => {
      if (err){
        res.status(500).send("Internal Server Error");
        return console.error(err.message);
      }
      console.log("TOTAL FAVOURITES: ",res2);
      db.query('SELECT last_logged_in FROM login WHERE id = ?', [req.session.userId], (err,res3) => {
        if (err){
          res.status(500).send("Internal Server Error");
          return console.error(err.message);
        }
        console.log("LAST LOGGED IN:", res3);
        db.query('SELECT SUM(calories) FROM RECIPES WHERE user_id = ?', [req.session.userId], (err,res4) => {
          if (err){
            res.status(500).send("Internal Server Error");
            return console.error(err.message);
          }
          console.log("TOTAL CALORIES:", res4);
          db.query('SELECT * FROM recipes WHERE user_id = ? ORDER BY recipe_id DESC LIMIT 1', [req.session.userId], (err,res5) => {
            if (err){
              res.status(500).send("Internal Server Error");
              return console.error(err.message);
            }
            console.log("MOST RECENT RECIPE:", res5);
            res.render('dashboard', {
              total_recipes: res1[0]['COUNT(*)'],
              total_favourites: res2[0]['COUNT(*)'],
              last_logged_in: res3[0].last_logged_in,
              total_calories: res4[0]['SUM(calories)'],
              most_recent_recipe: res5[0]
            })
          })
        })
      })
    })
  })
});

app.get('/signup', (req, res) => {
  res.render('signup');
})

app.post('/signup', (req, res) => {
  const { username, password, first_name, last_name, email, address} = req.body;
  let dob;
  if (!req.body.date_of_birth || req.body.date_of_birth == "0"){
    dob = null;
  } else {
    dob = req.body.date_of_birth;
  }
  db.query('SELECT * FROM login WHERE username = ?', [username], (err, results) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    if (results[0]){
      req.flash('error', "Username Is Already Taken");
      return res.redirect('/signup')
    }
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err){
        res.status(500).send("Internal Server Error");
        return console.error(err.message);
      }
      db.query ('INSERT INTO login (username, password) VALUES (?,?)', [username, hash], (err, res1) => {
        if (err) {
          res.status(500).send("Internal Server Error");
          return console.error (err.message);
        }
        console.log("ADDED LOGIN:", res1);
        db.query ('INSERT INTO userInfo (id, first_name, last_name, date_of_birth, email, address) VALUES (?,?,?,?,?,?)', 
          [res1.insertId, first_name, last_name, dob, email, address], (err, results) => {
          if (err) {
            res.status(500).send("Internal Server Error");
            return console.error (err.message);
          }
          console.log("ADDED USERINFO:", results);
          req.flash('success', 'User Signed Up Successfully');
          res.redirect('/login');
        })
      })
    })
  })
})

app.get('/account', checkUserLoggedIn, (req,res) =>{
  res.render('account');
})

app.get('/changePassword', checkUserLoggedIn, (req, res) => {
  res.render('changePassword');
})

app.post('/changePassword', checkUserLoggedIn, (req, res) => {
  const {oldPassword, newPassword} = req.body;
  db.query ('SELECT password FROM login WHERE id = ?', [req.session.userId], (err, results) =>  {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    bcrypt.compare(oldPassword, results[0].password, (err, result) => {
      if (err){
        res.status(500).send("Internal Server Error");
        return console.error(err.message);
      }
      if (result){
        bcrypt.hash(newPassword, saltRounds, (err, hash) => {
          if (err){
            res.status(500).send("Internal Server Error");
            return console.error(err.message);
          }
          db.query('UPDATE login SET password = ? WHERE id = ?', [hash, req.session.userId], (err, results) => {
            if (err){
              res.status(500).send("Internal Server Error");
              return console.error(err.message);
            }
            console.log('UPDATED THE PASSWORD:', results);
            req.flash('success', 'Password Changed Successfully')
            res.redirect('/changePassword');
          })
        })
      } else {
        req.flash('error', 'Password Does Not Match')
        res.redirect('/changePassword')
      }
    })
  })
})

app.get('/recipes', checkUserLoggedIn, (req, res) => {
  res.render('recipes');
})

app.get('/recipes/view', checkUserLoggedIn, (req, res) => {
  db.query('SELECT * FROM recipes WHERE user_id = ?', [req.session.userId], (err, results) => {
    if (err) {
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log(results);
    res.render('view', {
    recipes: results
    });
  })
})

app.get('/recipes/create', checkUserLoggedIn, (req, res) => {
  res.render('create');
})

app.post('/recipes/create', checkUserLoggedIn, (req,res) => {
  console.log(req.body);
  req.body.description = ToNullable(req.body.description);
  req.body.ingredients = ToNullable(req.body.ingredients);
  req.body.instructions = ToNullable (req.body.instructions);
  req.body.prep_time = NumberToNullable(req.body.prep_time);
  req.body.cooking_time = NumberToNullable(req.body.cooking_time);
  req.body.total_servings = NumberToNullable(req.body.total_servings);
  req.body.calories = NumberToNullable(req.body.calories);
  req.body.protein = DecimalToNullable(req.body.protein);
  req.body.carbohydrates = DecimalToNullable(req.body.carbohydrates);
  req.body.fat = DecimalToNullable(req.body.fat);
  const {name, description, ingredients, instructions, prep_time, cooking_time, total_servings, calories, protein, carbohydrates, fat} = req.body;
  let favourite;
  if (req.body.favourite){
    favourite = 1;
  } else {
    favourite = 0;
  }
  db.query('INSERT INTO recipes (user_id, name, description, ingredients, instructions, prep_time, cooking_time, total_servings, calories, protein, carbohydrates, fat, favourite) VALUES (?, ?, ?, ?, ? ,? ,? ,? ,? ,?, ?, ?, ?)',
    [req.session.userId, name, description, ingredients, instructions, prep_time, cooking_time, total_servings, calories, protein, carbohydrates, fat, favourite], (err, results) => {
      if (err) {
        res.status(500).send("Internal Server Error");
        return console.error(err.message);
      }
      console.log(results);
      req.flash('success', 'Recipe Created Successfully')
      res.redirect('/recipes/view');
    })
  
})

app.get('/recipes/view/:recipe_id', checkUserLoggedIn, (req, res) => {
  const recipe_id = req.params.recipe_id;
  db.query('SELECT * FROM recipes WHERE recipe_id = ?', [recipe_id], (err, results) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log(results);
    res.render('viewById', {
      recipe: results[0]
    })
  })
})

app.get('/recipes/delete/:recipe_id', checkUserLoggedIn, (req, res) => {
  const recipe_id = req.params.recipe_id;
  db.query('SELECT recipe_id, name FROM recipes WHERE recipe_id = ?', [recipe_id], (err, results) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log(results);
    res.render('deleteById', {
    recipe_id: results[0].recipe_id,
    name: results[0].name
    });
  })
})

app.post('/recipes/delete/:recipe_id', checkUserLoggedIn, (req, res) => {
  console.log(req.body);
  const choice = req.body.confirm;
  const recipe_id = req.params.recipe_id;
  if (choice == 'no'){
    return res.redirect(`/recipes/view/${recipe_id}`)
  }
  if (choice == 'yes'){
    db.query('DELETE FROM recipes WHERE recipe_id = ?', [recipe_id], (err, results) =>{
      if (err){
        return console.error(err.message);
      }
      console.log(results);
    })
    req.flash('success', 'Recipe Deleted Successfully')
    res.redirect('/recipes/view');
  }
})

app.get('/recipes/edit/:recipe_id', checkUserLoggedIn, (req,res) => {
  const recipe_id = req.params.recipe_id;
  db.query('SELECT * FROM recipes WHERE recipe_id = ?', [recipe_id], (err, results) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log(results);
    res.render('editById', {
      recipe: results[0]
    });
  })
})

app.post('/recipes/edit/:recipe_id', checkUserLoggedIn, (req,res) => {
  const recipe_id = req.params.recipe_id;
  req.body.description = ToNullable(req.body.description);
  req.body.ingredients = ToNullable(req.body.ingredients);
  req.body.instructions = ToNullable (req.body.instructions);
  req.body.prep_time = NumberToNullable(req.body.prep_time);
  req.body.cooking_time = NumberToNullable(req.body.cooking_time);
  req.body.total_servings = NumberToNullable(req.body.total_servings);
  req.body.calories = NumberToNullable(req.body.calories);
  req.body.protein = DecimalToNullable(req.body.protein);
  req.body.carbohydrates = DecimalToNullable(req.body.carbohydrates);
  req.body.fat = DecimalToNullable(req.body.fat);
  const {name, description, ingredients, instructions, prep_time, cooking_time, total_servings, calories, protein, carbohydrates, fat} = req.body;
  let favourite;
  if (req.body.favourite){
    favourite = 1;
  } else {
    favourite = 0;
  }
  db.query('UPDATE recipes SET user_id = ?, name = ?, description = ?, ingredients = ?, instructions = ?, prep_time = ?, cooking_time = ?, total_servings = ?, calories = ?, protein  = ?, carbohydrates = ?, fat = ?, favourite = ? WHERE recipe_id = ?', 
    [req.session.userId, name, description, ingredients, instructions, prep_time, cooking_time, total_servings, calories, protein, carbohydrates, fat, favourite, recipe_id], (err, results) => {
      if (err) {
        res.status(500).send("Internal Server Error");
        return console.error(err.message);
      }
      console.log(results);
      req.flash('success', 'Recipe Editted Successfully')
      res.redirect(`/recipes/view/${recipe_id}`);
    })
})

app.get('/favourites', checkUserLoggedIn, (req, res) => {
  db.query('SELECT * FROM recipes WHERE favourite = 1 AND user_id = ?', [req.session.userId], (err, results) => {
    if (err){
      res.status(500).send("Internal Server Error");
      return console.error(err.message);
    }
    console.log(results);
    res.render('favourites', {
      favourite_recipes:results
    })
  })
})

app.use((req,res,next) => {
  res.status(404).send('Page Not Found')
})
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).send('Internal Server Error');
})

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server Listening to http://localhost:${PORT}`)
})