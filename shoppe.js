/*CÁCH DÙNG:
B1: Mở Google Chrome, truy cập và đăng nhập vào Shopee.vn
B2: Vào mục "Đơn Mua": https://shope.ee/7pHF2r5lo0
B3: Nhấn tổ hợp phím Ctrl+Shift+J để mở tab "Console"
B4: Copy toàn bộ Code ở dưới. Paste vào tab "Console". Sau đó nhấn "Enter".
B5: Ra 1 box nhỏ cạnh trang Shopee, kéo ra, copy và paste vào Excel hoặc Google Sheet để xem
Nguồn: @nttkq */

const ORDER_STATUS = {
  3: "Hoàn thành",
  4: "Đã hủy",
  7: "Vận chuyển",
  8: "Đang giao",
  9: "Chờ thanh toán",
  12: "Trả hàng",
};

function formatCurrency(number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(number || 0));
}

function parseUnixDate(ts) {
  if (!ts) return null;
  const d = new Date(Number(ts) * 1000);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    timestamp: d.getTime(),
  };
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateInput(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inTimeRange(timestamp, fromDate, toDate) {
  if (!timestamp) return false;
  const t = Number(timestamp) * 1000;
  const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
  const end = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

  if (start !== null && t < start) return false;
  if (end !== null && t > end) return false;
  return true;
}

function showResult(text) {
  const box = document.createElement("textarea");
  box.value = text;
  box.style.position = "fixed";
  box.style.top = "20px";
  box.style.right = "20px";
  box.style.width = "1100px";
  box.style.height = "700px";
  box.style.fontSize = "12px";
  box.style.zIndex = "999999";
  box.style.border = "1px solid #ccc";
  box.style.padding = "12px";
  box.style.background = "#fff";
  document.body.appendChild(box);
}

async function getOrders(offset, limit) {
  const url =
    "https://shopee.vn/api/v4/order/get_all_order_and_checkout_list?limit=" +
    limit +
    "&offset=" +
    offset;

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        accept: "application/json, text/plain, */*",
      },
    });

    const json = await res.json();
    const list = json?.new_data?.order_or_checkout_data ?? [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error("Lỗi khi gọi API Shopee:", error);
    return [];
  }
}

function getItemInfo(item) {
  return item?.order_list_detail || item || {};
}

function getOrderStatus(detail) {
  const listType = Number(detail?.list_type || 0);
  return ORDER_STATUS[listType] || "Không rõ";
}

function getSubtotal(detail) {
  const infoCard = detail?.info_card || {};
  return safeNumber(infoCard?.subtotal || 0) / 1e5;
}

function getProductCount(detail) {
  const infoCard = detail?.info_card || {};
  return safeNumber(infoCard?.product_count || 0);
}

function getShopName(detail) {
  const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
  const shopInfo = orderCard?.shop_info || {};
  return `${shopInfo?.username || ""} - ${shopInfo?.shop_name || ""}`.trim();
}

function getProductName(detail) {
  const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
  const groups = orderCard?.product_info?.item_groups || [];
  return groups?.[0]?.items?.[0]?.name || "Không rõ";
}

function buildProductSummary(detail) {
  const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
  const groups = orderCard?.product_info?.item_groups || [];

  return groups
    .map((group) =>
      (group.items || [])
        .map(
          (item) =>
            `${item.name} -- amount: ${item.amount} -- price: ${formatCurrency(
              Number(item.item_price || 0)
            )}`
        )
        .join(", ")
    )
    .join("; ");
}

function getShippingTime(detail) {
  return detail?.shipping?.tracking_info?.ctime || detail?.ctime || 0;
}

function getDateText(detail) {
  const ts = getShippingTime(detail);
  const date = parseUnixDate(ts);
  return date ? `${date.day}/${date.month}/${date.year}` : "-";
}

function getDateStamp(detail) {
  const ts = getShippingTime(detail);
  return Number(ts || 0);
}

async function getAllOrders({ startDate = null, endDate = null } = {}) {
  const limit = 20;
  let offset = 0;
  const rows = [
    [
      "Tên chung",
      "Số lượng",
      "Tổng tiền",
      "Trạng thái",
      "Tên shop",
      "Chi tiết",
      "Tiền gốc",
      "Ngày Giao",
    ].join("\t"),
  ];

  let totalSpend = 0;
  let totalThisYear = 0;
  let totalSixMonths = 0;
  let totalOrderCount = 0;

  while (true) {
    const data = await getOrders(offset, limit);
    if (!data || data.length === 0) break;

    for (const item of data) {
      try {
        const detail = getItemInfo(item);
        const listType = Number(detail?.list_type || 0);
        const subtotal = getSubtotal(detail);
        const productCount = getProductCount(detail);
        const productName = getProductName(detail);
        const shopName = getShopName(detail);
        const statusText = getOrderStatus(detail);
        const dateText = getDateText(detail);

        const orderDateStamp = getDateStamp(detail);
        const inRange = inTimeRange(orderDateStamp, startDate, endDate);

        // Nếu có filter date, chỉ lấy các order nằm trong khoảng đó.
        if (startDate || endDate) {
          if (!inRange) continue;
        }

        const isValidOrder = listType !== 4 && listType !== 12;

        if (isValidOrder) {
          totalSpend += subtotal;
          totalOrderCount += 1;

          const date = parseUnixDate(orderDateStamp);
          const currentYear = new Date().getFullYear();
          if (date && date.year === currentYear) {
            totalThisYear += subtotal;
            if (date.month >= 7 && date.month <= 12) {
              totalSixMonths += subtotal;
            }
          }
        }

        const orderCard = detail?.info_card?.order_list_cards?.[0] || {};
        rows.push(
          [
            productName,
            productCount,
            formatCurrency(subtotal),
            statusText,
            shopName,
            buildProductSummary(detail),
            isValidOrder ? subtotal : 0,
            dateText,
          ].join("\t")
        );
      } catch (error) {
        console.error("Lỗi khi xử lý item:", item, error);
      }
    }

    offset += limit;
  }

  const totalLine = [
    "Tổng cộng: ",
    `${totalOrderCount} đơn,`,
    formatCurrency(totalSpend),
  ].join("\t");

  const totalYearLine = [
    "Tổng cộng trong năm nay: ",
    formatCurrency(totalThisYear),
  ].join("\t");

  const totalSixMonthsLine = [
    "Tổng cộng 6 tháng cuối năm: ",
    formatCurrency(totalSixMonths),
  ].join("\t");

  rows.push(totalLine);
  rows.push(totalYearLine);
  rows.push(totalSixMonthsLine);

  console.log(totalLine);
  console.log(totalYearLine);
  console.log(totalSixMonthsLine);

  const result = rows.join("\r\n");
  showResult(result);

  return {
    totalSpend,
    totalThisYear,
    totalSixMonths,
    totalOrderCount,
    rows,
  };
}

// CÁCH DÙNG FILTER THEO THỜI GIAN:
// 1. Để lấy toàn bộ: getAllOrders();
// 2. Để lọc theo khoảng thời gian: getAllOrders({ startDate: '2025-01-01', endDate: '2025-12-31' });
// 3. Chỉ từ ngày bắt đầu: getAllOrders({ startDate: '2025-01-01' });
// 4. Chỉ đến ngày kết thúc: getAllOrders({ endDate: '2025-12-31' });

getAllOrders({ startDate: "2025-01-01", endDate: "2025-12-31" });
