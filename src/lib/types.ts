export type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type LoanStatus = "active" | "paid" | "overdue" | "cancelled";
export type PaymentFrequency = "weekly" | "biweekly" | "monthly";

export type Loan = {
  id: string;
  client_id: string;
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  payment_frequency: PaymentFrequency;
  start_date: string;
  status: LoanStatus;
  notes: string | null;
  created_at: string;
};

export type LoanWithClient = Loan & { clients: { full_name: string } | null };

export type LoanBalance = {
  loan_id: string;
  client_id: string;
  principal_amount: number;
  interest_rate: number;
  status: LoanStatus;
  total_paid: number;
  balance: number;
};

export type Payment = {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  notes: string | null;
  created_at: string;
};
