export type CurrencyOption = {
  code: string;
  name: string;
};

export const popularCurrencies: CurrencyOption[] = [
  { code: "AED", name: "United Arab Emirates dirham" },
  { code: "ARS", name: "Argentine peso" },
  { code: "AUD", name: "Australian dollar" },
  { code: "BDT", name: "Bangladeshi taka" },
  { code: "BGN", name: "Bulgarian lev" },
  { code: "BRL", name: "Brazilian real" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "CHF", name: "Swiss franc" },
  { code: "CLP", name: "Chilean peso" },
  { code: "CNY", name: "Chinese yuan" },
  { code: "COP", name: "Colombian peso" },
  { code: "CZK", name: "Czech koruna" },
  { code: "DKK", name: "Danish krone" },
  { code: "EGP", name: "Egyptian pound" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "HKD", name: "Hong Kong dollar" },
  { code: "HUF", name: "Hungarian forint" },
  { code: "IDR", name: "Indonesian rupiah" },
  { code: "ILS", name: "Israeli new shekel" },
  { code: "INR", name: "Indian rupee" },
  { code: "JPY", name: "Japanese yen" },
  { code: "KES", name: "Kenyan shilling" },
  { code: "KRW", name: "South Korean won" },
  { code: "KWD", name: "Kuwaiti dinar" },
  { code: "MAD", name: "Moroccan dirham" },
  { code: "MXN", name: "Mexican peso" },
  { code: "MYR", name: "Malaysian ringgit" },
  { code: "NGN", name: "Nigerian naira" },
  { code: "NOK", name: "Norwegian krone" },
  { code: "NZD", name: "New Zealand dollar" },
  { code: "PEN", name: "Peruvian sol" },
  { code: "PHP", name: "Philippine peso" },
  { code: "PKR", name: "Pakistani rupee" },
  { code: "PLN", name: "Polish zloty" },
  { code: "QAR", name: "Qatari riyal" },
  { code: "RON", name: "Romanian leu" },
  { code: "SAR", name: "Saudi riyal" },
  { code: "SEK", name: "Swedish krona" },
  { code: "SGD", name: "Singapore dollar" },
  { code: "THB", name: "Thai baht" },
  { code: "TRY", name: "Turkish lira" },
  { code: "TWD", name: "New Taiwan dollar" },
  { code: "UAH", name: "Ukrainian hryvnia" },
  { code: "USD", name: "United States dollar" },
  { code: "UYU", name: "Uruguayan peso" },
  { code: "VND", name: "Vietnamese dong" },
  { code: "XOF", name: "West African CFA franc" },
  { code: "ZAR", name: "South African rand" },
  { code: "ZMW", name: "Zambian kwacha" }
].sort((a, b) => a.name.localeCompare(b.name));

export function normaliseCurrencyCode(value: string | null | undefined) {
  const code = String(value ?? "USD").trim().toUpperCase();
  return popularCurrencies.some((currency) => currency.code === code) ? code : "USD";
}
