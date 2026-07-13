import json
import re
from pathlib import Path
from urllib.parse import urlparse

import pdfplumber


INPUT_PDF = Path(
    r"C:\Users\ZhuanZ\xwechat_files\zhoushijie0123_12ae\msg\file\2025-10\无纸化标准服务能力V1.6.5(1).pdf"
)
OUTPUT_JSON = Path("tmp/pdfs/paperless_interfaces.json")

SYSTEM_NAME = "无纸化中台"


def compact_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def clean_title(raw: str) -> str:
    raw = re.sub(r"\.{3,}.*$", "", raw)
    return compact_space(raw)


def project_name_for(page_no: int, code: str) -> str:
    if page_no <= 14:
        return "接入前置准备"
    major = code.split(".", 1)[0]
    return {
        "1": "自然人实名认证",
        "2": "电子合同",
        "3": "电子印章管理",
        "4": "其他服务",
    }.get(major, "")


def backend_path(address: str) -> str:
    parsed = urlparse(address)
    if parsed.scheme and parsed.netloc:
        return parsed.path or "/"
    return address


def is_interface_heading(line: str) -> bool:
    line = compact_space(line)
    if re.match(r"^\d+(?:\.\d+){0,2}\s*\S", line) is None:
        return False
    if re.search(r"(接口输入参数|输入参数|接口输出参数|输出参数|请求示例|返回示例|注意事项|流程图|接口基础信息|请求头参数|请求体加密)", line):
        return False
    if "接口调用方法" in line:
        return False
    return True


def parse_heading(line: str):
    match = re.match(r"^(\d+(?:\.\d+){0,2})\s*(.+)$", compact_space(line))
    if not match:
        return None
    return match.group(1), clean_title(match.group(2))


def extract_rows():
    rows = []
    current = None
    pending_name = None

    with pdfplumber.open(INPUT_PDF) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            lines = [compact_space(raw_line) for raw_line in text.splitlines()]
            idx = 0
            while idx < len(lines):
                line = lines[idx]
                idx += 1
                if not line:
                    continue

                if is_interface_heading(line):
                    heading = parse_heading(line)
                    if heading:
                        current = {
                            "page": page_no,
                            "routeCode": heading[0],
                            "headingName": heading[1],
                        }

                if line.startswith("接口名称"):
                    name = clean_title(line.replace("接口名称", "", 1))
                    if name and name not in {"xxxx业务接口", SYSTEM_NAME}:
                        pending_name = {
                            "page": page_no,
                            "routeName": name,
                            "routeCode": current["routeCode"] if current else "",
                        }
                    else:
                        pending_name = None
                    continue

                if line.startswith("接口地址") and pending_name:
                    address = clean_title(line.replace("接口地址", "", 1))
                    while (
                        address.startswith(("http://", "https://"))
                        and idx < len(lines)
                        and re.fullmatch(r"[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+", lines[idx] or "")
                    ):
                        address += lines[idx]
                        idx += 1
                    if address.startswith("http://36.170.39.179"):
                        pending_name = None
                        continue
                    code = pending_name["routeCode"]
                    rows.append(
                        {
                            "系统名称": SYSTEM_NAME,
                            "路由编码(routeCode)": code,
                            "路由名称(routeName)": pending_name["routeName"],
                            "后端API路径(backendPath)": backend_path(address),
                            "项目分组(projectName)": project_name_for(pending_name["page"], code),
                        }
                    )
                    pending_name = None

    return rows


def main():
    rows = extract_rows()
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"rows": len(rows), "output": str(OUTPUT_JSON)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
