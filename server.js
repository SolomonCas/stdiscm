const express = require('express');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcrypt');
const Account = require('./model/accountSchema');
const path = require('path');
const app = express();
const session = require('express-session');
const mime = require('mime-types');
const rateLimit = require('express-rate-limit');
const fs = require('fs')
const fileType = require('file-type');
const v = require('validator');
const https = require('https');
const logger = require('./loggers/logger.js');
const debugMode = process.env.DEBUG_MODE;
const port = 4000;
// Set up the 'hbs' view engine
app.set('view engine', 'hbs');
app.use(express.static(__dirname));
app.use(express.json());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: './temp', // temp path
}));
app.set('views', './frontend');


app.use(session({
  secret: 'supersecretsessionkeynamedyomadalimakuha',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000 // 30 mins in milliseconds
  }
}))

const ensureAuth = (req, res, next) => { //for the future pag di na res.render yung login lang
  if (req.session.auth)
    next()
  else
    res.redirect('/')
}

const ensureNotAuth = (req, res, next) => {
  if(req.session.auth){
    return res.redirect('/main');
  }
  next();
}

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // maximum of 5 failed login attempts
  skipSuccessfulRequests: true,
  message: "Too many login attempts, please try again later"
})

// Define a route for '/register' to render the registration template
app.get('/', ensureNotAuth, (req, res) => {
  res.render('login.hbs');
});

// Handle the login form submission
app.post('/login', loginLimit, ensureNotAuth, async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if(email == undefined || password == undefined){
    logger.error(error.message);
    if(debugMode){
      logger.debug(error.stack);
    }
    res.send('Error has occurred');
  }
    
  let user;
  // Find the user by email
  let query = 'SELECT * FROM accounts WHERE email = ?';
  Account.node.query(query, [email], async (error, results) => {
    if (error) { // server issue
      // console.error('Error retrieving user:', error);
      logger.error('Error has occurred');
      if(debugMode)
        logger.debug(error);
      return res.send('Error has occurred');
    }
    if (results.length == 0) { // no email matched
      // console.error('Error retrieving user:', error);
      logger.info('Failed Login Attempt', { email:email});
      return res.send('Invalid Credentials');
    }
    user = Object.values(results[0]);
  
    if (user) {
      // Compare the provided password with the stored hashed password
      Object.values(user)
      const isMatch = await bcrypt.compare(password, user[5]);
  
      if (isMatch) {
        // Passwords match, user is authenticated
        req.session.auth = true;
        req.session.email = email;
        if(user[6] == "user"){// default login
          req.session.isAdmin = false;
          logger.info('User Authenticated', { email: email });
          //console.log(user)
          res.render('main.hbs', {profilePhoto: user[4], fullName: user[1], email: user[2], phoneNumber: user[3], role: user[6]});
        }
        else{// user is an admin
          req.session.isAdmin = true
          logger.info('Admin Authenticated', { email: email });
          res.redirect('/administration')
        }
          
        //res.send('Login successful');
      } else {
        // Passwords do not match
        req.session.isAuth = false;
        logger.info('Failed Login Attempt', { input:{email,password} });
        res.status(404).send('Invalid credentials');
      }
    } else {
      // User not found
      req.session.isAuth = false;
      logger.info('Failed Login Attempt', { input:{email,password} });
      res.status(404).send('Invalid credentials');
    }
  })
    
});

app.get('/main', ensureAuth, async (req, res) =>{
    let query = 'SELECT * FROM accounts WHERE email = ?';
    let email = req.session.email;
    if(email){
      Account.node.query(query, [email], async(error, results) => {
        if (error) { // server issue
          logger.error('Something went wrong');
          if(debugMode)
            logger.debug(error);
          return res.send('Error has occurred');
        }
        if (results.length == 0) { // no email matched
          logger.error('Error retrieving user:', {email:email});
          return res.send('Invalid User');
        }
        user = Object.values(results[0]);
        res.render('main.hbs', {profilePhoto: user[4], fullName: user[1], email: user[2], phoneNumber: user[3], role: user[6]});
      });
    } else {
      logger.error('Error has occurred');
      if(debugMode){
        logger.debug(error);
      }
      res.send('Error occured');
    }
    
});

// Logout Function
app.get('/logout', ensureAuth, (req, res) => {
  logger.info('User Logged Out', { email:req.session.email});
  req.session.destroy();
  res.render('login.hbs');
});

// Administration Function
app.get('/administration', ensureAuth, (req, res) => {
  //Check first if the user is actually an admin, to prevent normal user simply typing /administration
  if(req.session.isAdmin == undefined){
    logger.error('Error has occurred');
    if(debugMode){
      logger.debug(error);
    }
    return res.send('Error has occurred')
  }
  isTrue = req.session.isAdmin;

  if(isTrue){
    const query = 'SELECT * FROM accounts WHERE role = ?';
    Account.node.query(query, ['user'], (error, results) => {
      if (error) {
        logger.error('Error retrieving users');
        if(debugMode){
          logger.debug(error);
        }
        return res.send('Error occurred');
      }

      const users = Object.values(results);

      //console.log('the users:');
      //console.log(users);
      res.render('administration.hbs', {
        users: users,
      });
    });
      
      
  } else {
    logger.warn('Failed Accessing Administration', {email: req.session.email});
    res.redirect('/main')
  }
  
});

// Direct to registration hbs
app.get('/register', ensureNotAuth, (req, res) => {
  res.render('registration.hbs');
});

app.post('/registerdetails', ensureNotAuth, async(req, res) => {
  try{
   
      const profphoto = req.files.profilephoto;
      const fullname = v.escape(req.body.fullname);
      const email = req.body.email;
      const phone = req.body.phone;
      const password = req.body.password;

      // Input validation using regular expressions
      const emailRegex = /^[a-zA-Z0-9]+([_.-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,})+$/;
      const phoneRegex = /^09\d{9}$/;
      if (!emailRegex.test(email)) {
        fs.unlink(profphoto.tempFilePath, (err) => {
          if (err) {
            if(debugMode){
              logger.error('Failed to delete temporary file');
              logger.debug(err);
            }
          } else {
            logger.debug('Temporary file deleted');
          }
        });
        logger.info('Failed to Register User');
        logger.debug('Invalid email format')
        return res.send('<script>alert("Invalid email format"); window.location.href = "/register";</script>');
      }

      if (!phoneRegex.test(phone)) {
        fs.unlink(profphoto.tempFilePath, (err) => {
          if (err) {
            if(debugMode){
              logger.error('Failed to delete temporary file');
            
              logger.debug(err);
            }
          } else {
            logger.debug('Temporary file deleted');
          }
        });
        logger.info('Failed to Register User', {error: "Invalid phone number"});
        logger.debug("Invalid phone number")
        return res.send('<script>alert("Invalid phone number"); window.location.href = "/register";</script>');
      }
    
      // Check if any of the input fields are empty
      if (!profphoto || !fullname || !email || !phone || !password) {
        fs.unlink(profphoto.tempFilePath, (err) => {
          if (err) {
            if(debugMode){
              logger.error('Failed to delete temporary file');
            
              logger.debug(err);
            }
          } else {
            logger.debug('Temporary file deleted');
          }
        });
        logger.info('Failed to Register User', { error:"Please fill in all fields"});
        logger.debug('Please fill in all fields')
        return res.send('<script>alert("Please fill in all fields"); window.location.href = "/register";</script>');
      }
      // Check if the uploaded file is an image
      const fileMimeType = mime.lookup(profphoto.name);
      if (!fileMimeType || !fileMimeType.startsWith('image/')) {
        fs.unlink(profphoto.tempFilePath, (err) => {
          if (err) {
            if(debugMode){
              logger.error('Failed to delete temporary file');
            
              logger.debug(err);
            }
          } else {
            logger.debug('Temporary file deleted');
          }
        });
        logger.info('Failed to Register User', {error: "Invalid file format. Please upload an image file."});
        logger.debug("Invalid file format. Please upload an image file.")
        return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/register";</script>');
      }

      
      const fileData = fs.readFileSync(profphoto.tempFilePath);

      // Validate the magic number
      const fileTypeResult = fileType(fileData);
      if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
        fs.unlink(profphoto.tempFilePath, (err) => {
          if (err) {
            if(debugMode){
              logger.error('Failed to delete temporary file');
            
              logger.debug(err);
            }
          } else {
            logger.debug('Temporary file deleted');
          }
        });
        logger.info('Failed to Register User', { error:"Invalid file format. Please upload an image file."});
        logger.debug("Invalid file format. Please upload an image file.")
        return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/register";</script>');
      }

        // Check if the email already exists in the database
        let query = "SELECT * from accounts where email = ?";
        Account.node.query(query, [email], async(error, existingUser)=>{
          if(existingUser && existingUser.length > 0){
            //console.log(existingUser)
            fs.unlink(profphoto.tempFilePath, (err) => {
              if (err) {
                if(debugMode){
                  logger.error('Failed to delete temporary file');
                
                  logger.debug(err);
                }
              } else {
                logger.debug('Temporary file deleted');
              }
            });
            logger.info('Failed to Register User', {error: "Email already registered"});
            logger.debug('Email already registered')
            return res.send('<script>alert("Email already registered"); window.location.href = "/register";</script>');
          }
          else{ // register the account
            try {
              // Hash the password
              const hashedPassword = await bcrypt.hash(password, 10);
            
              let query = "INSERT INTO accounts (fullName, email, phoneNumber, profilePhoto, password, role) VALUES(?,?,?,?,?,?)";
              Account.node.query(query,[fullname, email, phone, "images/" + profphoto.name, hashedPassword, "user"], (err, result)=>{
                if(err){
                  //console.log(err);
                  if(debugMode){
                    logger.debug(err)
                  }
                  return;
                }
                else{
                  if(debugMode){
                    logger.debug("ADDING THE ACCOUNT:")
                    logger.debug(result);
                  }
                  const uploadPath = path.join(__dirname, 'images', profphoto.name);
                  profphoto.mv(uploadPath, (error) => {
                    if (error) {
                      logger.debug("failed to save photo")
                      if(debugMode){
                        logger.debug(error);
                      }
                      logger.error('Failed to Register User');
                    } else {
                      if(debugMode){
                        logger.debug("ADDED")
                      }
                      logger.info('User Registration Successful', { email: email });
                      res.redirect('/')
                    }
                  });
                }
              })
            
            } 
            catch (err) {
              //console.log(err);
              logger.error('Failed to Register User');
              if(debugMode){
                logger.debug(err);
              }
            }
          }
        })
  
      
  }
  catch(err){
    logger.error('Failed to Register User');
    if(debugMode){
      logger.debug(err);
    }
    res.send('<script>alert("Something went wrong"); window.location.href = "/register";</script>');
  }
  
});

app.post('/editUser', ensureAuth, async(req, res) => {
  // Input validation using regular expressions
  try{
    let originalemail;
    if(req.session.isAdmin == true){
      originalemail = req.body.originalemail
    }
    else{
      originalemail = req.session.email
    }
  const email = req.body.email;
  let id;
  const fullname = v.escape(req.body.fullname);
  const phone = req.body.phone;
  if(debugMode){
    logger.debug("START EDIT");
    console.log(req.body)
  }
  const emailRegex = /^[a-zA-Z0-9]+([_.-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,})+$/;
  const phoneRegex = /^09\d{9}$/;
  if (!emailRegex.test(email)) {
    if(req.session.isAdmin){
      logger.info('Failed to Edit User', { editedUser: email, error:"Invalid email format"});
      logger.debug("Invalid email format")
      return res.send('<script>alert("Invalid email format"); window.location.href = "/administration";</script>');
    }
    logger.info('Failed to Edit User', { editedUser: email, error:"Invalid email format"});
    logger.debug("Invalid email format")
    return res.send('<script>alert("Invalid email format"); window.location.href = "/main";</script>');
  }

  if (!phoneRegex.test(phone)) {
    if(req.session.isAdmin){
      logger.info('Failed to Edit User', { editedUser: email, error:"Invalid phone number"});
      logger.debug("Invalid phone number")
      return res.send('<script>alert("Invalid phone number"); window.location.href = "/administration";</script>');
    }
    logger.info('Failed to Edit User', { editedUser: email, error:"Invalid phone number"});
    logger.debug("Invalid phone number")
    return res.send('<script>alert("Invalid phone number"); window.location.href = "/main";</script>');
  }
  let accquery = "Select * from accounts where email = ?"
  Account.node.query(accquery, [originalemail], (err, obj)=>{
    if(err){
      logger.error('account not found')
      if(debugMode){
        logger.debug(err);
      }
    }
    else{
      obj = Object.values(obj[0])
      id = obj[0]
          // Check if the email is still the same
      let query0 = "SELECT * from accounts where id = ?";
      let imagename = "";
      Account.node.query(query0, [id], async(err, currentUser)=>{
        if(err){
          logger.error('account not found')
          if(debugMode){
            logger.debug(err);
          }
        }
        if(currentUser){
          currentUser = Object.values(currentUser[0])
          imagename = currentUser[4]
          if(currentUser[2] != email){ // email is changed
          
            query0 = "SELECT * from accounts where email = ?";
            Account.node.query(query0, [email], async(err, existingEmail)=>{
      
              if(existingEmail.length > 0){
                logger.debug(`EXISTING: ${existingEmail}`)
                if(req.session.isAdmin){
                  logger.info('Failed to Edit User', { editedUser: email, error:"Email already in use"});
                  logger.debug("Email already in use")
                  return res.send('<script>alert("Email already in use");window.location.href = "/administration";</script>')
                }
                logger.info('Failed to Edit User', { editedUser: email, error:"Email already in use"});
                logger.debug("Email already in use")
                return res.send('<script>alert("Email already in use");window.location.href = "/main";</script>')
              }
              else{
                let sameimage = false;
                let profphoto;
                //check if image was changed
                if(req.files?.profilephoto){
                  profphoto = req.files.profilephoto
                  imagename = "images/" + profphoto.name
                  // Check if the uploaded file is an image
                  const fileMimeType = mime.lookup(profphoto.name);
                  if (!fileMimeType || !fileMimeType.startsWith('image/')) {
                    fs.unlink(profphoto.tempFilePath, (err) => {
                      if (err) {
                        if(debugMode){
                          logger.error('Failed to delete temporary file');
                          logger.debug(err);
                        }
                      } else {
                        //console.log('Temporary file deleted');
                        logger.debug('Temporary file deleted');
                      }
                    });
                    if(req.session.isAdmin){
                      logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                      logger.debug("Invalid file format. Please upload an image file.")
                      return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/administration";</script>');
                    }
                    logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                    logger.debug("Invalid file format. Please upload an image file.")
                    return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/main";</script>');
                  }
              
                  // Read the file contents
                  if(debugMode){
                    logger.debug('File contents')
                    console.log(profphoto)
                  }
                  
                  const fileData = fs.readFileSync(profphoto.tempFilePath);
              
                  // Validate the magic number
                  const fileTypeResult = fileType(fileData);
                  if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
                    fs.unlink(profphoto.tempFilePath, (err) => {
                      if (err) {
                        //console.error('Failed to delete temporary file:', err);
                        if(debugMode){
                          logger.error('Failed to delete temporary file');
                          logger.debug(err);
                        }
                      } else {
                        //console.log('Temporary file deleted');
                        logger.debug('Temporary file deleted');
                      }
                    });
                    if(req.session.isAdmin){
                      logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                      logger.debug("Invalid file format. Please upload an image file.")
                      return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/administration";</script>');
                    }
                    logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                    logger.debug("Invalid file format. Please upload an image file.")
                    return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/main";</script>');
                  }
                }
                else{ // if image remains the same
                  sameimage = true;
                  logger.debug(sameimage)
                }

                  //update the details normally
                  // console.log(sameimage)
                  logger.debug(sameimage)
                  if((req.body.pass).length > 0){
                    let query = "UPDATE accounts SET email = ?, fullName = ?, phoneNumber = ?, profilePhoto= ?, password = ? where id = ?";
                    const hashedPassword = await bcrypt.hash(req.body.pass, 10);
                    Account.node.query(query,[email, fullname, phone, imagename, hashedPassword, id], (err, result)=>{
                      if(err){
                        if(debugMode){
                          logger.debug(err);
                        }
                        logger.info('Failed to Edit User', { editedUser: email});
                        return;
                      }
                      else{
                        if(!sameimage){
                          const uploadPath = path.join(__dirname, "images", profphoto.name);
                          profphoto.mv(uploadPath, (error) => {
                            if (error) {
                              if(debugMode){
                                logger.error("failed to save photo")
                                logger.debug(error);
                              }
                              logger.info('Failed to Edit User', { editedUser: email});
                              
                            } else {
                              if(debugMode){
                                logger.debug("ADDED");
                              }
                              if(req.session.isAdmin){
                                logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                                res.redirect('/administration')
                              }
                              else{
                                logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                                req.session.email = email;
                                res.redirect('/main')
                              }
                              
                            }
                          });
                        }
                        else{
                          if(req.session.isAdmin){
                            logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                            res.redirect('/administration')
                          }
                          else{
                            logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                            req.session.email = email;
                            res.redirect('/main')
                          }
                          
                        }
                        
                      }
                    })
                  }
                  else{
                    let query = "UPDATE accounts SET email = ?, fullName = ?, phoneNumber = ?, profilePhoto= ? where id = ?";
                  
                    Account.node.query(query,[email, fullname, phone, imagename, id], (err, result)=>{
                      if(err){
                        logger.info('Failed to Edit User', { editedUser: email});
                        if(debugMode){
                          logger.debug(err);
                        }
                        return;
                      }
                      else{
                        if(!sameimage){
                          const uploadPath = path.join(__dirname, "images", profphoto.name);
                          profphoto.mv(uploadPath, (error) => {
                            if (error) {
                              if(debugMode){
                                logger.error('failed to save image')
                                logger.debug(err);
                              }
                              logger.info('Failed to Edit User', { editedUser: email});
                            } else {
                              if(debugMode){
                                logger.debug("ADDED");
                              }
                              
                              if(req.session.isAdmin){
                                logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                                res.redirect('/administration')
                              }
                              else{
                                logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                                req.session.email = email;
                                res.redirect('/main')
                              }
                              
                            }
                          });
                        }
                        else{
                          if(req.session.isAdmin){
                            logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                            res.redirect('/administration')
                          }
                          else{
                            logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                            req.session.email = email;
                            res.redirect('/main')
                          }
                        
                        }
                        
                      }
                    })
                  }
              
              }
          
            })
          
        
          }
          else{
            let sameimage = false;
            let profphoto;
            //check if image was changed
            if(req.files?.profilephoto){
              profphoto = req.files.profilephoto
              imagename = "images/" + profphoto.name
              // Check if the uploaded file is an image
              const fileMimeType = mime.lookup(profphoto.name);
              if (!fileMimeType || !fileMimeType.startsWith('image/')) {
                fs.unlink(profphoto.tempFilePath, (err) => {
                  if (err) {
                    if(debugMode){
                      logger.error('Failed to delete temporary file');
                      logger.debug(err);
                    }
                  } else {
                    logger.debug('Temporary file deleted');
                  }
                });
                if(req.session.isAdmin){
                  logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                  logger.debug("Invalid file format. Please upload an image file.")
                  return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/administration";</script>');
                }
                logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                logger.debug("Invalid file format. Please upload an image file.")
                return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/main";</script>');
              }
          
              // Read the file contents
              if(debugMode){
                logger.debug('File contents')
                console.log(profphoto)
              }
              // logger.debug(profphoto);
              const fileData = fs.readFileSync(profphoto.tempFilePath);
          
              // Validate the magic number
              const fileTypeResult = fileType(fileData);
              if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
                fs.unlink(profphoto.tempFilePath, (err) => {
                  if (err) {
                    if(debugMode){
                      logger.error('Failed to delete temporary file');
                      logger.debug(err);
                    }
                  } else {
                    logger.debug('Temporary file deleted');
                  }
                });
                if(req.session.isAdmin){
                  logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                  logger.debug("Invalid file format. Please upload an image file.")
                  return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/administration";</script>');
                }
                logger.info('Failed to Edit User', { editedUser: email, error:"Invalid file format. Please upload an image file."});
                logger.debug("Invalid file format. Please upload an image file.")
                return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/main";</script>');
              }
            }
            else{ // if image remains the same
              sameimage = true;
              logger.debug(sameimage);
            }

              //update the details normally
              // console.log(sameimage)
              logger.debug(sameimage);
              if((req.body.pass).length > 0){
                let query = "UPDATE accounts SET email = ?, fullName = ?, phoneNumber = ?, profilePhoto= ?, password = ? where id = ?";
                const hashedPassword = await bcrypt.hash(req.body.pass, 10);
                Account.node.query(query,[email, fullname, phone, imagename, hashedPassword, id], (err, result)=>{
                  if(err){
                    logger.error('Failed to Edit User', { editedUser: email});
                    if(debugMode){
                      logger.debug(err);
                    }
                    return;
                  }
                  else{
                    if(!sameimage){
                      const uploadPath = path.join(__dirname, "images", profphoto.name);
                      profphoto.mv(uploadPath, (error) => {
                        if (error) {
                          if(debugMode){
                            logger.error('failed to save photo');
                            logger.debug(error);
                          }
                          //console.log("failed to save photo")
                          logger.info('Failed to Edit User', { editedUser: email});
                        } else {
                          //console.log("ADDED");
                          if(debugMode){
                            logger.debug('ADDED');
                          }
                          if(req.session.isAdmin){
                            logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                            res.redirect('/administration')
                          }
                          else{
                            logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                            req.session.email = email;
                            res.redirect('/main')
                          }
                          
                        }
                      });
                    }
                    else{
                      if(req.session.isAdmin){
                        logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                        res.redirect('/administration')
                      }
                      else{
                        logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                        req.session.email = email;
                        res.redirect('/main')
                      }
                      
                    }
                    
                  }
                })
              }
              else{
                let query = "UPDATE accounts SET email = ?, fullName = ?, phoneNumber = ?, profilePhoto= ? where id = ?";
              
                Account.node.query(query,[email, fullname, phone, imagename, id], (err, result)=>{
                  if(err){
                    logger.error('Failed to Edit User', { editedUser: email});
                    if(debugMode){
                      logger.debug(err);
                    }
                    return;
                  }
                  else{
                    if(!sameimage){
                      const uploadPath = path.join(__dirname, "images", profphoto.name);
                      profphoto.mv(uploadPath, (error) => {
                        if (error) {
                          if(debugMode){
                            logger.error('failed to save photo');
                            logger.debug(error);
                          }
                          //console.log("failed to save photo")
                          logger.info('Failed to save photo', { email: req.session.email});
                          // console.log(error);
                        } else {
                          //console.log("ADDED");
                          logger.debug("ADDED");
                          if(req.session.isAdmin){
                            logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                            res.redirect('/administration')
                          }
                          else{
                            logger.info('User performed edit', { email: req.session.email,updatedDetails:[email,fullname,phone,imagename]});
                            req.session.email = email;
                            res.redirect('/main')
                          }
                          
                        }
                      });
                    }
                    else{
                      if(req.session.isAdmin){
                        logger.info('Admin edited User', { editedUser: originalemail,updatedDetails:[email,fullname,phone,imagename]});
                        res.redirect('/administration')
                      }
                      else{
                        logger.info('User performed edit', { email: req.session.email, updatedDetails:[email,fullname,phone,imagename]});
                        req.session.email = email;
                        res.redirect('/main')
                      }
                      
                    }
                    
                  }
                })
              }
          }
          
        }
      })
    }
  })
  }
  catch{
    // console.log('an error occurred')
    if(debugMode){
      logger.debug('an error occurred');
    }
    return res.send('Please Try Again')
  }
 
});

app.post('/deleteUser',ensureAuth, (req, res)=>{
  try{
    const email = req.body.emailToBeDeleted;
    let userId;
    
    logger.debug("START DELETE");
    if(debugMode){
      console.log(req.body)
    }
    const userquery = 'Select * from accounts where email = ?';
    Account.node.query(userquery, [email], (err, user)=>{
      if(err){
        logger.error('Failed in Deleting User', { usertoDelete: email});
        if(debugMode){
          logger.debug(err);
        }
        return;
      }
      else{
          user = Object.values(user[0]);
          userId = user[0]
          const deletePostsQuery = 'DELETE FROM posts WHERE userid = ?';
          Account.node.query(deletePostsQuery, [userId], (error, results) => {
            if (error) {
              logger.error('Failed in Deleting User', { usertoDelete: email});
              // console.error('Error deleting posts:', error);
              if(debugMode){
                logger.error('Error deleting posts')
                logger.debug(error);
              }
              return;
            }
            //proceed with deleting user
            let delquery = "Delete from accounts where email = ?"
            Account.node.query(delquery, [email], (err, obj)=>{
              if(err){
                logger.error('Failed in Deleting User', { email: req.session.email});
                if(debugMode){
                  logger.debug(error);
                }
              }
              else{
                if(debugMode){
                  logger.debug("User to delete");
                  console.log(obj)
                }
                logger.info('User is deleted', { deleteduser: email});
                res.redirect('/administration')
              }
            })
        
            });
          
          }
      })
    
  }
  catch{
    
    return res.send('Please Try Again')
  }
  
});

app.get('/getPosts', ensureAuth, (req, res)=>{
  try{
    if(debugMode){
      logger.debug("AT GET POSTS");
    }
    let postsquery = "SELECT posts.id, posts.content, posts.postPhoto, accounts.fullName AS username FROM posts INNER JOIN accounts ON posts.userid = accounts.id ORDER BY posts.id DESC;"
    Account.node.query(postsquery, (err, posts)=>{
      if (err) {
        if(debugMode){
          logger.error(err);
        }
        res.status(500).json({ error: 'Error fetching posts' });
      } else {
        if(debugMode){
          logger.debug("GET POSTS");
        }
        res.status(200).json({ posts });
      }
    })
  }
  catch{
    logger.error("error fetching posts")
  }
})

app.post('/submitPost',ensureAuth, (req, res)=>{
  try{
    if(debugMode){
      logger.debug('SUBMIT POST');
    }
    const author = req.session.email;
    const content = v.escape(req.body.content);
    const postPhoto = req.files.postphoto;

    // Check if any of the input fields are empty
    if (!postPhoto || !author) {
      fs.unlink(postPhoto.tempFilePath, (err) => {
        if (err) {
          if(debugMode){
            logger.error('Failed to delete temporary file');
          
            logger.debug(err);
          }
        } else {
          logger.debug('Temporary file deleted');
        }
      });
      logger.info('Failed to Register User', { error:"Please fill in all fields"});
      logger.debug('Please fill in all fields')
      return res.send('<script>alert("Please fill in all fields"); window.location.href = "/register";</script>');
    }

    // Check if the uploaded file is an image
    const fileMimeType = mime.lookup(postPhoto.name);
    if (!fileMimeType || !fileMimeType.startsWith('image/')) {
      fs.unlink(postPhoto.tempFilePath, (err) => {
        if (err) {
          if(debugMode){
            logger.error('Failed to delete temporary file');
           
            logger.debug(err);
          }
        } else {
          logger.debug('Temporary file deleted');
        }
      });
      logger.info('Failed to Register User', {error: "Invalid file format. Please upload an image file."});
      logger.debug("Invalid file format. Please upload an image file.")
      return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/register";</script>');
    }

    const fileData = fs.readFileSync(postPhoto.tempFilePath);

    // Validate the magic number
    const fileTypeResult = fileType(fileData);
    if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
      fs.unlink(postPhoto.tempFilePath, (err) => {
        if (err) {
          if(debugMode){
            logger.error('Failed to delete temporary file');
           
            logger.debug(err);
          }
        } else {
          logger.debug('Temporary file deleted');
        }
      });
      logger.info('Failed to Register User', { error:"Invalid file format. Please upload an image file."});
      logger.debug("Invalid file format. Please upload an image file.")
      return res.send('<script>alert("Invalid file format. Please upload an image file."); window.location.href = "/register";</script>');
    }

    let userquery = "Select * from accounts where email = ?";
    let insertquery = "Insert into posts (content, postPhoto, userid) VALUES(?, ?, ?)";
    Account.node.query(userquery, [author], (err, user)=>{
      user = Object.values(user[0])
      if(err){
        logger.error('Failed to get User', { email: req.session.email});
        if(debugMode){
          logger.debug(err);
        }
        return res.send('No User')
      }
      else{
        Account.node.query(insertquery, [content, "images/" + postPhoto.name, user[0]], (err, result)=>{
          if(err){
            // console.log(err)
            logger.error('Failed Submission of a post', { email: req.session.email});
            if(debugMode){
              logger.debug(err);
            }
            return res.send('Cannot insert')
          }
          else{
            // console.log(result)
            logger.debug(result);
            const uploadPath = path.join(__dirname, 'images', postPhoto.name);
                  postPhoto.mv(uploadPath, (error) => {
                    if (error) {
                      logger.debug("failed to save photo") 
                      if(debugMode){
                        logger.debug(error);
                      }
                      logger.error('Failed to Register User');
                    } else { 
                      if(debugMode){
                        logger.debug("ADDED")
                      }
                      if(user[6] == 'admin'){
                        logger.info('Admin submitted post', { email: req.session.email, content:content, postPhoto:postPhoto});
                        res.redirect('/administration')
                      }
                      else{
                        logger.info('User submitted post', { email: req.session.email, content:content, postPhoto:postPhoto});
                        res.redirect('/main')
                      }
                    }
                  });
          }
        })
      }
    })
    


  }
  catch{
    return res.send('Please Try Again')
  }
})
// Start the server

const httpsapp = https.createServer(
    {
      key: fs.readFileSync(path.join(__dirname, 'certificate', 'key.pem')), 
      cert: fs.readFileSync(path.join(__dirname, 'certificate', 'certificate.pem'))
    }, 
  app
  );
httpsapp.listen(port);


