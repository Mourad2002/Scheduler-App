// Express module for building HTTP servers
var express = require("express");


var app = express();
app.use(function(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`Request to ${req.path} took ${duration}ms`);
  });
  next();
});
const path = require('path');
app.set('views', path.join(__dirname, 'static', 'html')); // pug was html
app.set('view engine', 'pug');

// Session middleware for handling user sessions
var session = require('express-session');

// bcrypt for hashing passwords
const bcrypt = require('bcrypt');

// MySQL for database connections
var mysql = require("mysql");

// Create a MySQL connection pool (adjust with your database connection details)
var pool = mysql.createPool({
  connectionLimit : 10,
  host: "cse-mysql-classes-01.cse.umn.edu", // Replace with your MySQL host
  user: "C4131S24NU59", // Replace with your MySQL username
  password: "3531", // Replace with your MySQL password
  database: "C4131S24NU59", // Replace with your MySQL database name
  port: 3306
});

// Middleware to parse JSON and urlencoded data in requests
app.use(express.json()); // Support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // Support URL-encoded bodies

// Session configuration
app.use(session({
  secret: "csci4131secretkey", // Secret key for signing the session ID
  saveUninitialized: true,
  resave: false
}));

// Serve static files from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Route to serve the welcome page from the root URL '/'
// Route for the root ('/') page
app.get('/', function(req, res) {
  
  res.render('welcome', { title: 'Welcome' }); // Always show welcome page
});

// Route for navigating to the login page
app.get('/login', function(req, res) {
  if (req.session.loggedin) {
    res.redirect('schedule'); // If logged in, go to the dashboard or a protected page
  } else {
    res.render('login', { title: "Login Page" }); // If not logged in, show the login page
  }
});


// Route to handle the login form submission
app.post('/perform_login', function(req, res) {
  const { username, password } = req.body;

  // Query the database for the user
  pool.query('SELECT * FROM tbl_accounts WHERE acc_login = ?', [username], function (error, results, fields) {
    if (error) {
      res.status(500).send('Internal Server Error');
      return;
    }
    if (results.length > 0) {
      // Compare the hashed password
      bcrypt.compare(password, results[0].acc_password, function(err, result) {
        if (result) {
          req.session.user = { id: results[0].acc_id, username: results[0].acc_login }; // Adjusted session setting
          req.session.loggedin = true; // Ensure this is set to handle conditional checks in other routes
          res.send({ status: 'ok', message: 'Login successful' }); // Send a JSON response
        } else {
          res.status(401).send('Login failed');
        }
      });
    } else {
      res.status(401).send('Username not found');
    }
  });
});

app.delete('/events/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  console.log(`Attempting to delete event with ID: ${eventId}`);  // Log the ID to check correctness

  const query = 'DELETE FROM tbl_events WHERE event_id = ?';
  pool.query(query, [eventId], (error, results) => {
      if (error) {
          console.error('Delete operation failed:', error);
          return res.status(500).json({ success: false, message: 'Failed to delete event' });
      }
      console.log('Deletion successful:');
      res.json({ success: true, message: 'Event deleted successfully' });
  });
});




app.get('/index', function (req, res) {
  if (req.session.loggedin) {
    res.render('index', { title: 'Home Page' }); // Render index.pug
  } else {
    res.redirect('/login');
  }
});

app.get('/login', function(req, res) {
  if (req.session.loggedin) {
    res.redirect('schedule'); // Redirect to the schedule if already logged in
  } else {
    res.render('/login', {title: "Log In"});;
  }
});


app.get('/addEvent', function(req, res) {
  if (req.session.loggedin) {
    res.render('addEvent', { title: 'Add Event' }); // Assumes you have an 'addEvent.pug' or equivalent template
  } else {
    res.redirect('/login');
  }
});


app.post('/postEventEntry', function(req, res) {
  if (!req.session.user) {
    return res.status(401).send('User not logged in');
  }

  const { event, day, start, end, phone, location, info, url } = req.body;

  let insertQuery = 'INSERT INTO tbl_events (event_day, event_event, event_start, event_end, event_location, event_phone, event_info, event_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

  pool.query(insertQuery, [day, event, start, end, location, phone, info, url], function(error, results, fields) {
    if (error) {
      console.error('Error adding event:', error);
      res.status(500).send('Failed to add event');
    } else {
      console.log('Event added:', results);
      //res.send('Event added successfully');
      res.json({ message: 'Event added successfully' });

    }
  });
});

app.get('/creatAccount', function(req, res) {
  res.render('addAccount');
});

app.post('/checkOverlap', function(req, res) {
  const { day, start, end } = req.body;
  
  // Example SQL query to check for overlaps
  const query = `
    SELECT * FROM tbl_events 
    WHERE event_day = ? AND NOT (event_end <= ? OR event_start >= ?)
  `;

  pool.query(query, [day, start, end], (error, results) => {
    if (error) {
      console.error('Database error:', error);
      return res.status(500).send({ message: 'Database error', error: error.message });
    }

    if (results.length > 0) {
      res.json({ overlap: true, count: results.length, events: results });
    } else {
      res.json({ overlap: false });
    }
  });
});


app.get('/schedule', function(req, res) {
  if (req.session.user) {
    res.render('schedule'); // Make sure 'schedule' corresponds to a Pug file name
  } else {
    res.redirect('/login');
  }
});



// In your Node.js application (index.js)

// Route to fetch schedule data and send it as JSON
app.get('/getSchedule', function(req, res) {
  pool.query('SELECT * FROM tbl_events', function(error, results) {
    if (error) {
      console.error('Error fetching schedule:', error);
      res.status(500).send('Failed to fetch schedule');
    } else {
      console.log('Schedule fetched successfully:', results);
      res.json(results);  // This still uses `res.json` since it's an API endpoint returning data
    }
  });
});

app.get('/edit/:id',function(req, res) {
  if (req.session.loggedin){
  const id = req.params.id;
  //const sql = 'SELECT * FROM tbl_events WHERE event_id = ?';
  pool.query('SELECT * FROM tbl_events WHERE event_id = ?', id, (err, results) => {
    if (err) {
      console.error('Error fetching schedule data:', err);
      res.status(500).json({ error: 'Error fetching schedule data' });
      return;
    }
    res.render('editEvent', {event: results[0]});
  });
}else{
    res.redirect("/login");
}
});



app.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error logging out');
    }
    res.redirect('/login'); // Redirect to a known route like the homepage or login page
  });
});

app.post('/change/:id', function(req, res) {
  if (req.session.loggedin){
  const id = req.params.id;
  const {event, day, start, end, phone, location, info, url } = req.body;
  
  // Insert data into the tbl_events table

  const values = [event, day, start, end, phone, location, info, url, id];

  pool.query('UPDATE tbl_events set event_event = ?, event_day = ?, event_start = ?, event_end = ?, event_phone = ?, event_location = ?, event_info = ?, event_url = ? where event_id = ?', values, (err, result) => {
    if (err) {
      console.error('Error updating event:', err);
      res.sendStatus(404);
      return;
    }

    console.log('Event updated successfully');
    res.redirect("/schedule");
  });
  }else{
  res.redirect("/login");
}
});
// Route for the 'Home' page
app.get('/Home', function(req, res) {
  if (req.session.loggedin) {
    res.render('home', { title: 'Welcome' }); // Assuming you have a 'home.pug' template
  } else {
    res.redirect('/login');
  }
});

app.get('/createAccount', function(req, res) {
  console.log('Views directory set to:', app.get('views'));
  res.render('addAccount', function(err, html) {
      if (err) {
          console.log(err);
          res.send('Error rendering view.');
      } else {
          res.send(html);
      }
  });
});


app.post('/createAccount', async function(req, res) {
  const { email, password } = req.body;
  if (password.length < 6) {
    return res.status(400).send('Password must be at least 6 characters long.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  pool.query('SELECT * FROM tbl_accounts WHERE acc_login = ?', [email], function(err, results) {
    if (results.length > 0) {
      res.send('An account with this email already exists.');
    } else {
      pool.query('INSERT INTO tbl_accounts (acc_login, acc_password) VALUES (?, ?)', [email, hashedPassword], function(err, result) {
        if (err) {
          res.status(500).send('Error creating account');
        } else {
          req.session.loggedin = true;
          req.session.username = email;
          res.redirect('/schedule');
        }
      });
    }
  });
});

app.post('/createAccount', async function(req, res) {
  const { email, password } = req.body;

  // Simple validation for demonstration
  if (password.length < 6) {
    res.render('new_account', { message: 'Password must be at least 6 characters long.' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Check if the email already exists
    pool.query('SELECT * FROM tbl_accounts WHERE acc_login = ?', [email], function(err, results) {
      if (err) {
        res.status(500).send('Database error occurred.');
        return;
      }
      if (results.length > 0) {
        // Email already exists
        res.render('new_account', { message: 'An account with this email already exists.' });
      } else {
        // Insert new account
        pool.query('INSERT INTO tbl_accounts (acc_login, acc_password) VALUES (?, ?)', [email, hashedPassword], function(err, result) {
          if (err) {
            res.status(500).send('Error creating account');
          } else {
            // Log the user in
            req.session.loggedin = true;
            req.session.username = email;
            res.redirect('/schedule');
          }
        });
      }
    });
  } catch (error) {
    res.status(500).send('Failed to hash password');
  }
});








// Catch-all route for handling 404 errors
app.get('*', function(req, res) {
  res.status(404).send('Not Found');
});

// Start the server on port 9007
app.listen(9007, () => console.log('Listening on port 9007!'));
