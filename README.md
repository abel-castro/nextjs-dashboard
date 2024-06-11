# Next.js Next-Dashboard tutorial (DB docker)

This is the code of the official Next.js tutorial from https://nextjs.org/learn/dashboard-app but slightly modified to run the database locally with docker.

## How to start

1. Copy or rename **.env.template** as **.env**. Run this command `openssl rand -base64 32` and put the output as value for `AUTH_SECRET` in your **.env** file.

2. Start the db

   ```sh
   docker-compose up -d
   ```

3. Create initial data

   ```sh
   npm run seed
   ```

4. Start dev server

   ```sh
   npm run dev
   ```

5. Login with this credentials:

- Email: user@nextmail.com
- Password: 123456
