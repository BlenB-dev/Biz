const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const mysql = require('mysql2');
const path = require("path");
const router = express.Router();
const dotenv = require('dotenv');
const multer = require("multer");
const fs = require("fs");


dotenv.config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});
// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Mock user data (in production, you'd use a database)
const users = [{ username: 'user', passwordHash: bcrypt.hashSync('pass', 8) }, { username: 'user2', passwordHash: bcrypt.hashSync('pass', 8) }];

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};


// Routes
router.post('/login', (req, res) => {
  const { userNameEmail, userPassword } = req.body;
  console.log(req.body);
  const user = users.find(user => user.username === userNameEmail);
  

  // if (!user) {
  //   res.send({ message: `No user with the name ${username}` });

  //   // return res.status(401).send({ message: 'No user with that name' });
  // }
  // if (!bcrypt.compareSync(password, user.passwordHash)) {
  //   res.send({ message: 'Wrong Password' });

  //   // return res.status(401).send({ message: 'Wrong Password' });
  // }
  // if (!user || !bcrypt.compareSync(userPassword, user.passwordHash)) {
  //   return res.send({ message: `Invalid credentials Username: ${userNameEmail} & Password ${userPassword}` });
  // }


  if (!user || !bcrypt.compareSync(userPassword, user.passwordHash)) {
    return res.status(401).send({ message: `Invalid credentials` });
  }

  const token = generateToken(user);
  res.send({ message:  'Login successful.', token });
});



router.get('/trial', (req, res) => {
  console.log("Successful Trail");
  res.json('Auth route works');
})

router.get('/testEmail', async (req, res) => {
  const url = `http://localhost:5173/`;
  const email =   `amanuel.dereje.nv2994@gmail.com`
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Confirmation',
    html: `<h3>Hello Amanuel </h3><p>We are testing if the Email Works href="${url}">Confirm Email</a></p>`,
  };

  await transporter.sendMail(mailOptions);
  res.status(200).json({ message: 'Signup successful! Please check your email to confirm.' });
    

  console.log("Successful Trail");
  // res.json('Auth route works');
})

// Signup route
router.post('/signup', async (req, res) => {
  const { username, email, password, userType } = req.body;
  console.log(username, email, password, userType);

  try {

    const queryUserList = 'Select COUNT(*) as count FROM Users WHERE username = ? OR email = ?;';
    db.query(queryUserList, [username, email], async (err, result) => {
      if (result[0].count != 0) return res.status(400).json({ message: 'User already exists' });
      if (err) return res.status(500).json({ message: 'Database error at 1' });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a JWT token for email verification
        const verificationToken = await jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Insert User into Applicants table
            
            const queryAddApplicants = 'INSERT INTO Applicants (username, email, password, verification_token, userType) VALUES (?, ?, ?, ?, ?)';
            db.query(queryAddApplicants, [username, email, hashedPassword, verificationToken, userType], async (err, result) => {
              // if (err) return res.status(500).json({ message: 'Database error at 2' });
              if (err) return res.status(500).json({ message: JSON.stringify(err)});
                
                // Send confirmation email
                const url = `http://localhost:${process.env.PORT}/api/auth/confirm/${verificationToken}`;
                const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Email Confirmation',
                html: `<h3>Hello ${username}</h3><p>Please confirm your email by clicking on the link: <a href="${url}">Confirm Email</a></p>`,
                };
    
                await transporter.sendMail(mailOptions);

                res.status(200).json({ message: 'Signup successful! Please check your email to confirm.' });
    
    

        });


          
      

    });






  } catch (error) {
    res.status(500).json({ message: 'Error during signup' });
  }
});

// Email confirmation route
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Verify JWT token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {return res.status(400).json({ message: 'Invalid or expired token' });}
        const email = decoded.email;

        // Get User Values From Applicants Table
        const queryGetNewUserData = 'SELECT * FROM Applicants WHERE email = ? AND verification_token = ? ORDER BY id ASC LIMIT 1;';
        db.query(queryGetNewUserData, [email, token], (err, result) => {
            if (err){console.log(JSON.stringify(err)); return res.status(500).json({ message: 'Database error 3' });}
            if(result.length == 0){console.log(JSON.stringify(err)); return res.status(400).json({ message: "Expired or invalid token" });}
            else{

            const VToken = result[0].verification_token;
            const UserType = result[1].userType;
            const data = {
              token: VToken, // Some example data
            };

          
            // Redirect to the React frontend with data as query params
            const queryString = `?token=${data.token}`;
            if(UserType == "Startups") res.redirect(`http://localhost:5173/NewStartupForm${queryString}`); 
            else if(UserType == "Investors") return res.status(400).json({ message: "Undone UserType: " + UserType });
            else if(UserType == "ServiceProvider") return res.status(400).json({ message: "Undone UserType: " + UserType });
            else return res.status(400).json({ message: "Invalid UserType: " + UserType });
          

          }

        });

    });
    
  } catch (error) {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// router.post('/createProfile', async (req, res) => {
  
// })

// Ensure the uploads directory exists, and if not, create it
const uploadsDirectory = path.join(__dirname, "../../Storage/StartupStorage/PitchDeck");
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename with extension
  },
});


const upload = multer({ storage });

// Route to handle file and form data submission
router.post("/createStartupProfile", upload.single("file"), async (req, res) => {
  // console.log(req.body.token);
  const { token, startupName, founders, foundersBio, businessDescription,  industrySector,businessModel,
    stageOfDevelopment, subCity, fundingRequirement, currentFundingStatus, useOfFunds, revenueModel, currentRevenue,
    marketSize, competitiveAdvantage, customerBase, financialProjections, teamSize, keyTeamMembers, advisors,
    legalStructure, existingPartnerships, socialImpactGoals, startupEmail, phone1, phone2 } = req.body;
    
  const filePath = req.file ? req.file.path : null;

      const newForm = {
        token : token,
        startupName: startupName,
        founders: founders,
        foundersBio:foundersBio,
        businessDescription:businessDescription,
        industrySector: industrySector,
        businessModel : businessModel,
        stageOfDevelopment : stageOfDevelopment, 
        subCity : subCity, 
        fundingRequirement: fundingRequirement,
        currentFundingStatus : currentFundingStatus,
        useOfFunds : useOfFunds,
        revenueModel : revenueModel,
        currentRevenue : currentRevenue,
        marketSize : marketSize,
        competitiveAdvantage : competitiveAdvantage,
        customerBase : customerBase,
        financialProjections : financialProjections,
        teamSize : teamSize,
        keyTeamMembers :  keyTeamMembers,
        advisors : advisors,
        legalStructure :  legalStructure,
        existingPartnerships :  existingPartnerships,
        socialImpactGoals : socialImpactGoals,
        pitchDeckURL : filePath,
        startupEmail : startupEmail,
        phone1 : phone1,
        phone2 : phone2,
        pitchDeckURL : filePath,
      };
      

  try {




        //Verify JWT token
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
          if (err) {return res.status(400).json({ message: 'Invalid or expired token' }); console.log("Invalid or expired token")}
          const email = decoded.email;
          console.log("Email: "+email);
          console.log("Token: "+token);
  
          // Get User Values From Applicants Table
          const queryGetNewUserData = 'SELECT * FROM Applicants WHERE verification_token = ? ORDER BY id ASC LIMIT 1;';
          db.query(queryGetNewUserData, [token], (err, result) => {
              if (err){console.log(JSON.stringify(err)); return res.status(500).json({ message: 'Database error 3' });}
              if(result.length == 0){console.log("Empty Return form Applicants Table"); return res.status(400).json({ message: "Expired or invalid token" });}
              else{
              const username = result[0].username;
              const password = result[0].password;
              const userType = result[0].userType;
              const userEmail = result[0].email;

              console.log("Username: " + username + "\nPassword: " +password + "UserType: " + userType);
  
              // Add User to the Users table
              const queryRegisterUsers = 'INSERT INTO Users (username, email, password, userType) VALUES (?, ?, ?, ?)';
              db.query(queryRegisterUsers, [username, userEmail, password, userType], (err, result) => {
                  if (err) return res.status(500).json({ message: 'Database error at 4' });
  
                  // Remove the user from the Applicants
                  const queryDeleteApplicant = 'DELETE FROM Applicants WHERE email = ?';
                  db.query(queryDeleteApplicant, [userEmail], (err, result) => {
                      if (err) return res.status(500).json({ message: 'Database error - 5' });
          
                      const getNewUserID = 'Select UserID FROM users WHERE email = ?';
                      db.query(getNewUserID, [userEmail], (err, result) => {
                          if (err) return res.status(500).json({ message: 'Database error - 6' });
                          const userID = result[0].UserID;

                              const addToStartups = 'INSERT INTO `startups` ( `UserID`, `StartupName`, `FounderName`, `FounderBio`, `BusinessDescription`, `IndustrySector`, `BusinessModel`, `StageOfDevelopment`, `SubCity`, `FundingRequirement`, `CurrentFundingStatus`, `UseOfFunds`, `RevenueModel`, `CurrentRevenue`, `MarketSizeAndPotential`, `CompetitiveAdvantage`, `CustomerBase`, `FinancialProjection`, `TeamSize`, `LegalStructure`, `SocialImactGoals`, `KeyTeamMembers`, `Advisors`, `Partners`, `PickDeckURL`, `StartupEmail`, `Phone1`, `Phone2`, `SignupDate`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP());';
                              db.query(addToStartups, [userID, startupName, founders, foundersBio, businessDescription, industrySector, businessModel, stageOfDevelopment, subCity, fundingRequirement, currentFundingStatus, useOfFunds, revenueModel, currentRevenue, marketSize, competitiveAdvantage, customerBase, financialProjections, teamSize, legalStructure, socialImpactGoals, keyTeamMembers, advisors, existingPartnerships, filePath, startupEmail, phone1, phone2], (err, result) => {
                                  if (err){console.log(err); return res.status(500).json({ message: 'Database error at 4' });}
                                    res.json({ message: "Registered Successfully", form: newForm });

                                    });

  
      
                      });
                      });
          
              });
            }
  
          });
  
      });
  

  } catch (error) {
    res.status(500).json({ message: "Error saving form data", error });
  }
});


module.exports = router;
