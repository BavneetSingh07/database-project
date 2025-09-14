const ejs = require('ejs');
const express = require('express');
const mysql = require('mysql2')
const session = require('express-session');

const app = express();

app.use(session({
  secret: 'Ijustknowihavetocreateasuperlargestringforthis',
  resave: false,
  saveUninitialized: false,
}));


const db = mysql.createConnection({
  host:'127.0.0.1',
  user: 'root',
  password: 'royalarsenal121-',
  database: 'database_project_1',
  dateStrings: true
});

db.connect((err) =>{
  if (err) {
    console.error('Database Connection Unsuccesful');
  } else {
    console.log('database connected successfully');
  }
  
});

app.use((err, req, res, next) => {
  res.render('error', {
    error: "Error Occured"
  })
})

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
      return res.render('error', {
        error: "Query couldn't be accessed"
      })
    }
    console.log("RESULT:", results);
    if (results[0].password == password){
      req.session.userId = results[0].id;
      res.redirect('/dashboard');
    } else {
      res.send('login unsuccessful');
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
  req.session.destroy((err => {
    if (err){
      return console.error(err.message);
    }
    res.redirect('/');
  }))
})

app.get('/update', checkUserLoggedIn, (req,res) =>{
  db.query('SELECT * from userInfo where id = ?', [req.session.userId], (err, results) =>{
    if (err) {
      return console.error (err.message);
    }
    console.log(results[0])
    res.render ('update', {
      user: results[0]
    })
  })
})

app.post('/update', (req, res) => {
  db.query ('UPDATE userInfo SET first_name = ?, last_name = ?, date_of_birth = ?, email = ?, address = ? WHERE id = ?',
    [req.body.first_name, req.body.last_name, req.body.date_of_birth, req.body.email, req.body.address, req.session.userId], 
    (err, results) => {
      if (err) {
        return console.error(err.message);
      }
      res.redirect('/dashboard');
    })
})

app.get('/delete', checkUserLoggedIn, (req,res) => {
  res.render('delete');
})

app.post('/delete', (req,res) => {
  console.log(req.body);
  const choice = req.body.confirm;

  if (choice == "no"){
    return res.redirect('dasboard');
  }

  if (choice == "yes"){
    db.query('DELETE FROM userInfo WHERE id = ?', [req.session.userId], (err, results) => {
      if (err) {
        return console.error (err.message);
      }
      console.log("DELETE FROM USERINFO TABLE: ", results[0]);
    })
    db.query('DELETE FROM login WHERE id = ?', [req.session.userId], (err, results) => {
      if (err) {
        return console.error (err.message);
      }
      console.log("DELETE FROM LOGIN TABLE: ", results[0]);
    })
  }
})

app.get('/dashboard', checkUserLoggedIn, (req, res) => {
  db.query('SELECT * FROM userInfo where id = ?', [req.session.userId], (err, results) => {
    if (err){
      return res.render('error', {
        error: "Query couldn't be accessed"
      })
    }
    console.log(results[0]);
    res.render('dashboard', {
      user: results[0]
    });
  });
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
  db.query ('INSERT INTO login (username, password) VALUES (?,?)', [username, password], (err, res1) => {
    if (err) {
      return console.error (err.message);
    }
    console.log("ADDED LOGIN:", res1[0]);
    db.query ('INSERT INTO userInfo (id, first_name, last_name, date_of_birth, email, address) VALUES (?,?,?,?,?,?)', 
      [res1.insertId, first_name, last_name, dob, email, address], (err, results) => {
      if (err) {
        return console.error (err.message);
      }
      console.log("ADDED USERINFO:", results[0]);
    })
  })
 
})

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server Listening to http://localhost:${PORT}`)
})