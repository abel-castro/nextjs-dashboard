import { unstable_noStore as noStore } from 'next/cache';

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
  Invoice,
  Customer,
} from './definitions';
import { formatCurrency } from './utils';

import { Pool } from 'pg';
const pool = new Pool({
  user: 'nextjs_dashboard_user',
  host: 'localhost',
  database: 'nextjs_dashboard_db',
  password: 'nextjs_dashboard_password',
  port: 5432,
});

export async function queryDatabase(
  queryText: string,
  params: Array<any> = [],
): Promise<any[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(queryText, params);
    return rows;
  } finally {
    client.release();
  }
}

export async function fetchRevenue() {
  // Add noStore() here to prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();

  try {
    console.log('Fetching revenue data...');

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const rows = await queryDatabase('SELECT * FROM revenue');

    console.log('Data fetch completed after 3 seconds.');

    return rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();

  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    const rows = await queryDatabase(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
    `);

    const latestInvoices = rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();

  try {
    const invoiceCountQuery = queryDatabase('SELECT COUNT(*) FROM invoices');
    const customerCountQuery = queryDatabase('SELECT COUNT(*) FROM customers');
    const invoiceStatusQuery = queryDatabase(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
      FROM invoices
    `);

    const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
      invoiceCountQuery,
      customerCountQuery,
      invoiceStatusQuery,
    ]);

    return {
      numberOfCustomers: Number(customerCount[0].count ?? '0'),
      numberOfInvoices: Number(invoiceCount[0].count ?? '0'),
      totalPaidInvoices: formatCurrency(invoiceStatus[0].paid ?? '0'),
      totalPendingInvoices: formatCurrency(invoiceStatus[0].pending ?? '0'),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 5;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
): Promise<Invoice> {
  noStore();

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  try {
    return await queryDatabase(
      `
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
      ORDER BY invoices.date DESC
      LIMIT $3 OFFSET $2
    `,
      [`%${query}%`, offset, ITEMS_PER_PAGE],
    );
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch filtered invoices.');
  }
}

export async function fetchInvoicesPages(query: string): Promise<number> {
  noStore();

  try {
    const rows = await queryDatabase(
      `
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
    `,
      [`%${query}%`],
    );
    return Math.ceil(Number(rows[0].count) / ITEMS_PER_PAGE);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoice pages.');
  }
}

export async function fetchInvoiceById(id: string): Promise<Invoice> {
  noStore();

  try {
    const rows = await queryDatabase(
      `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $1;
    `,
      [id],
    );
    const invoice = rows.map((invoice: Invoice) => ({
      ...invoice,
      amount: invoice.amount / 100, // Assuming the amount is stored as cents
    }));
    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice by ID.');
  }
}

export async function fetchCustomers(): Promise<Customer[]> {
  noStore();

  try {
    return await queryDatabase(
      `SELECT id, name FROM customers ORDER BY name ASC`,
    );
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(
  query: string,
): Promise<Customer[]> {
  noStore();

  try {
    const rows = await queryDatabase(
      `
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1
      GROUP BY customers.id
      ORDER BY customers.name ASC
    `,
      [`%${query}%`],
    );
    return rows.map((customer: any) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch filtered customers.');
  }
}

export async function getUser(email: string): Promise<User | null> {
  noStore();

  try {
    const rows = await queryDatabase(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
