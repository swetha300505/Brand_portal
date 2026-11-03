# Complete Cloud Deployment Guide: MongoDB Atlas + Render + Vercel

> **Mobileum Caller ID Platform (Brand Portal)**  
> **Repository:** `https://github.com/swetha300505/Brand_portal.git`  
> **Target Branch:** `main`  
> **Project Directory:** `portals-main`

---

## 📌 Quick Summary Before You Begin

Our project has all source code inside the `portals-main` folder. In cloud production, the application runs in **Unified Mode** (`node server.js`), which serves all 3 portals from a single web address:
- **Central Hub:** `https://your-domain.com/`
- **Operator Portal:** `https://your-domain.com/operator`
- **Enterprise Portal:** `https://your-domain.com/enterprise`
- **Customer Phone Preview:** `https://your-domain.com/customer`
- **REST APIs:** `https://your-domain.com/api/...`

Follow this guide in order:
1. **Part 1:** Set up **MongoDB Atlas** (Free cloud database to store packages & requests).
2. **Part 2:** Deploy on **Render** (Recommended for Node.js Express web servers).
3. **Part 3:** Deploy on **Vercel** (Serverless alternative).
4. **Part 4:** Verification & Troubleshooting.

---

# PART 1: MongoDB Atlas Setup (Free Cloud Database)

MongoDB Atlas gives you a free 512 MB cloud database forever. You need this connection string so your live cloud app can save and fetch packages, brand requests, and numbers.

### Step 1.1: Create an Account
1. Open your browser and go to: **[https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)**
2. Sign up with your Google account or enter your email and password.
3. Accept the Terms and click **Submit**.

---

### Step 1.2: Build a Free Database Cluster
1. On the welcome screen, choose the **M0 (Free)** plan:
   - Select **M0 Free** (Tile says *Free Forever*, *Shared RAM*, *512MB Storage*).
2. **Cloud Provider & Region**:
   - Choose **AWS** or **Google Cloud**.
   - Select the region closest to you (e.g., `Mumbai (ap-south-1)` or `Singapore (ap-southeast-1)`).
3. **Name your Cluster**:
   - Leave it as `Cluster0` (or name it `mobileum-cluster`).
4. Click the green button: **Create Deployment** (or **Create Cluster**).

---

### Step 1.3: Create a Database User (Username & Password)
Atlas will prompt you with "How would you like to authenticate your connection?":
1. Select **Username and Password**.
2. Enter a username:
   - Example: `brandadmin`
3. Enter a password:
   > ⚠️ **IMPORTANT TIP ON PASSWORDS:**  
   > Avoid using symbols like `@`, `:`, `/`, or `%` in your database password because they break database URLs.  
   > Use a strong alphanumeric password with simple hyphens or underscores, for example: `MobileumPass2026`
4. Click **Create User** (or **Add User**).  
   *Write down your username and password in a notepad!*

---

### Step 1.4: Network Access (Allow Cloud Servers to Connect)
Atlas will ask "Where would you like to connect from?":
1. Select **My Local Environment** or click **Network Access** in the left sidebar menu under the "Security" section.
2. Click **+ Add IP Address** (green button).
3. In the popup dialog, click the button that says:
   - **Allow Access from Anywhere** (This fills in `0.0.0.0/0`).
4. Description: Enter `Allow Cloud Platforms`.
5. Click **Confirm**.
   *(Note: This is mandatory so Render and Vercel cloud servers can read and write to your database).*

---

### Step 1.5: Get Your MongoDB Connection URI
1. In the left navigation menu, click **Database** (under "Deployment").
2. Look at your `Cluster0` card and click the **Connect** button.
3. In the modal that appears, select **Drivers** (under "Connect to your application").
4. Select Driver: `Node.js`, Version: `5.5 or later`.
5. Scroll down to step 3: **"Add your connection string into your application code"**.
6. You will see a connection string like this:
   ```text
   mongodb+srv://brandadmin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
7. Copy this string to your notepad and edit it:
   - Replace `<password>` with your actual password (e.g. `MobileumPass2026`).
   - Add `/mobileum_portals` right before the `?retryWrites=true`:
   
   **Final Formatted String:**
   ```text
   mongodb+srv://brandadmin:MobileumPass2026@cluster0.abcde.mongodb.net/mobileum_portals?retryWrites=true&w=majority
   ```
8. Save this string! You will paste it as the `MONGODB_URI` environment variable in Render and Vercel.

---

# PART 2: Hosting on Render (Recommended for Express & Web)

Render is ideal for Node.js Express servers. It provides free web service hosting with custom domains and automatic HTTPS.

### Step 2.1: Log in to Render
1. Go to: **[https://render.com](https://render.com)**
2. Click **GET STARTED FOR FREE** or **Sign In**.
3. Choose **GitHub** to sign in (Authorize Render to access your GitHub repositories).

---

### Step 2.2: Create a New Web Service
1. On your Render Dashboard, click the blue **New +** button in the top right.
2. Select **Web Service**.
3. Under **"Connect a repository"**, you will see your GitHub repositories.
4. Find `swetha300505/Brand_portal` (if you do not see it, click *Configure account* and allow Render access to the repository).
5. Click **Connect** next to `swetha300505/Brand_portal`.

---

### Step 2.3: Configure the Web Service Settings
Fill out the form fields with the exact values below:

| Field | Exact Value to Enter / Select |
| :--- | :--- |
| **Name** | `mobileum-brand-portal` *(or any unique name you like)* |
| **Region** | Select closest region (e.g., `Singapore` or `Frankfurt`) |
| **Branch** | `main` |
| **Root Directory** | `portals-main` ⚠️ *(DO NOT leave this blank!)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` ⚠️ *(MUST be `node server.js`)* |
| **Instance Type** | Select **Free** ($0/month) |

---

### Step 2.4: Add the MongoDB Environment Variable
1. Scroll down to the section titled **Environment Variables**.
2. Click **Add Environment Variable**.
3. In the **Key** field, type:
   ```text
   MONGODB_URI
   ```
4. In the **Value** field, paste your Atlas connection string from Part 1:
   ```text
   mongodb+srv://brandadmin:MobileumPass2026@cluster0.abcde.mongodb.net/mobileum_portals?retryWrites=true&w=majority
   ```

---

### Step 2.5: Deploy and Launch
1. Click the blue button at the bottom: **Deploy Web Service** (or **Create Web Service**).
2. Render will show the live deployment terminal:
   - It will run `npm install` inside `portals-main`.
   - It will run `node server.js`.
   - You will see:
     ```text
     [DB] Connected to MongoDB database: mobileum_portals
     Mobileum Unified Portal running at http://0.0.0.0:10000
     ```
3. Once the top badge turns green with **"Live"**, your URL is displayed directly under the service name:
   `https://mobileum-brand-portal.onrender.com`

---

### Step 2.6: Open Your Live Portals
Click the link or open the URLs in your browser:
- **Central Portal Hub:** `https://mobileum-brand-portal.onrender.com/`
- **Operator Portal:** `https://mobileum-brand-portal.onrender.com/operator`
- **Enterprise Portal:** `https://mobileum-brand-portal.onrender.com/enterprise`
- **Customer Phone:** `https://mobileum-brand-portal.onrender.com/customer`

---

# PART 3: Hosting on Vercel (Alternative Serverless Deployment)

Vercel provides instant global serverless deployment. The repository already includes `vercel.json` and `index.js` configured for Vercel.

### Step 3.1: Log in to Vercel
1. Go to: **[https://vercel.com](https://vercel.com)**
2. Click **Log In** or **Sign Up**.
3. Choose **Continue with GitHub**.

---

### Step 3.2: Import Your Repository
1. On your Vercel Dashboard, click **Add New...** (top right) $\rightarrow$ select **Project**.
2. In the list of Git repositories, search for `Brand_portal`.
3. Click the blue **Import** button next to `swetha300505/Brand_portal`.

---

### Step 3.3: Configure Project Settings
In the "Configure Project" screen:

1. **Project Name**: `brand-portal` (default is fine).
2. **Framework Preset**:
   - Click the dropdown and select **Other**.
3. **Root Directory**:
   - Click the **Edit** button next to *Root Directory*.
   - Click the folder icon and select `portals-main` (or type `portals-main`).
   - Click **Continue**.

---

### Step 3.4: Add Environment Variables
1. Expand the section called **Environment Variables**.
2. **Key**: `MONGODB_URI`
3. **Value**: paste your MongoDB Atlas connection string:
   ```text
   mongodb+srv://brandadmin:MobileumPass2026@cluster0.abcde.mongodb.net/mobileum_portals?retryWrites=true&w=majority
   ```
4. Click the **Add** button.

---

### Step 3.5: Deploy
1. Click the blue **Deploy** button.
2. Vercel will install dependencies and package your serverless application.
3. In ~60 seconds, you will see confetti and a preview screenshot with the message: **"Congratulations! You just deployed a new Project to Vercel."**
4. Click **Continue to Dashboard** or click the domain link (e.g., `https://brand-portal-xyz.vercel.app`).

---

### Step 3.6: Open Your Live Portals on Vercel
- **Operator Portal:** `https://brand-portal-xyz.vercel.app/operator`
- **Enterprise Portal:** `https://brand-portal-xyz.vercel.app/enterprise`
- **Customer Phone:** `https://brand-portal-xyz.vercel.app/customer`

---

# PART 4: Verification & Sanity Checklist

Once deployed on either Render or Vercel:

1. **Check the Database Pill in Top Bar:**
   - In both the Operator Portal and Enterprise Portal, look at the top right header chip:
   - It should display:
     ```text
     ● Database: MongoDB (mobileum_portals) · Live
     ```
2. **Test Package Creation (Operator Portal):**
   - Go to `/operator`, open the "Packages" tab.
   - Enter a package name (e.g., `Diamond Plus`).
   - Enter Monthly Price (e.g. `25000`), Capacity (`50`), Duration (`30 days`).
   - Choose included features.
   - Click **Publish Package**.
   - Verify the package card appears immediately on the right side.
3. **Test Enterprise Request Creation:**
   - Go to `/enterprise`, open "Brand Requests Management".
   - Select your newly created package from the dropdown.
   - Notice how the logo dropzone or call reason dynamically hides/shows based on the package features.
   - Submit the request and verify it appears in the table.
4. **Inspect MongoDB Atlas:**
   - Log into MongoDB Atlas $\rightarrow$ **Database** $\rightarrow$ Click **Browse Collections**.
   - You will see the `mobileum_portals` database with collections: `packages`, `brand_requests`, `departments`, `numbers`.

---

# PART 5: Troubleshooting & FAQs

### Q1: My build failed with `Cannot find module 'express'`
- **Cause:** The cloud provider tried to run at the root of the repository instead of inside the `portals-main` folder.
- **Fix:** In Render or Vercel, go to **Settings** $\rightarrow$ change **Root Directory** to `portals-main`, save, and redeploy.

### Q2: Database status shows "In-Memory / Local Fallback" instead of "MongoDB · Live"
- **Cause:** `MONGODB_URI` environment variable is either missing, misspelled, or has an invalid password.
- **Fix:**
  1. Check that the variable name is spelled exactly `MONGODB_URI` (all uppercase).
  2. Check if your MongoDB password contains special characters like `@` or `:`. If so, in MongoDB Atlas go to **Database Access** $\rightarrow$ click **Edit** on your user $\rightarrow$ change password to plain letters and numbers (e.g. `Mobileum2026Secure`). Update the URI in your cloud settings and redeploy.

### Q3: Render deployment times out or says "Connection refused" to MongoDB
- **Cause:** MongoDB Atlas is blocking cloud server IPs.
- **Fix:** In MongoDB Atlas, go to **Network Access** in the left sidebar $\rightarrow$ check if IP `0.0.0.0/0` is listed with status *Active*. If not, click **Add IP Address** $\rightarrow$ click **Allow Access from Anywhere** $\rightarrow$ **Confirm**.

### Q4: Render free tier went to sleep after inactivity
- **Note:** Render's free tier spins down after 15 minutes of inactivity. The first visit might take 30-40 seconds to wake up. This is standard free tier behavior.

---

### 🎉 You're All Set!
Keep this guide handy whenever sharing the project with teammates or setting up new environments.
