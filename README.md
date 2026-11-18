# ClassRoom — Hệ thống lớp học trực tuyến

**Bài tiểu luận cuối kỳ môn Lập trình Web (MERN Stack)**  
**Sinh viên: Phạm Đình Bảo — MSSV: 1822040642**  
Repository: https://github.com/CodeWithBao/online-classroom-mern

ClassRoom tổ chức việc học theo từng khóa học. Giảng viên chuẩn bị bài đọc, tài liệu PDF, liên kết video và giao bài tập; sinh viên ghi danh, theo dõi các bài đã học rồi nộp bài ngay trong lớp. Điểm và nhận xét được lưu cùng bài nộp để sinh viên có thể xem lại. Quản trị viên phụ trách tài khoản và danh mục khóa học.

Ứng dụng dùng React với functional components, hooks và Context ở phía giao diện. Express cung cấp REST API; MongoDB lưu dữ liệu thông qua các schema Mongoose. Mật khẩu được băm bằng bcrypt và các API được bảo vệ bằng JWT. Việc kiểm tra vai trò, chủ sở hữu khóa học và trạng thái ghi danh diễn ra ở backend, không chỉ dựa vào các nút đang hiển thị trên giao diện.

## Chạy dự án

Máy cần Node.js 22 trở lên và npm. Mở terminal tại thư mục gốc của dự án rồi cài các thư viện:

```bash
npm run install:all
```

### Chạy thử với dữ liệu mẫu

```bash
npm run dev:demo
```

Chế độ này chạy một tiến trình MongoDB thật bằng `mongodb-memory-server` và lưu dữ liệu phát triển trong `server/.data`. Lần đầu cần Internet để tải MongoDB binary; thời gian khởi động sẽ lâu hơn các lần sau. Đây là chế độ phục vụ chạy thử cục bộ, không phải cấu hình triển khai thực tế. Nếu mạng chặn tải MongoDB, dùng MongoDB cài sẵn hoặc Atlas theo hướng dẫn bên dưới.

Giao diện mặc định ở **http://localhost:5173**. API ở **http://localhost:5000/api**. Các tài khoản mẫu dùng chung mật khẩu `Classroom@123`:

| Vai trò | Email |
| --- | --- |
| Quản trị viên | `admin@classroom.local` |
| Giảng viên | `teacher@classroom.local` |
| Sinh viên | `student@classroom.local` |

Tài khoản đăng ký từ giao diện luôn là sinh viên. Để tạo một giảng viên mới, đăng ký tài khoản rồi dùng tài khoản quản trị viên cấp vai trò giảng viên. Không cho phép người đăng ký tự cấp quyền quản trị.

### Dùng MongoDB của bạn

Sao chép `server/.env.example` thành `server/.env`. Trong Git Bash/macOS/Linux có thể dùng:

```bash
cp server/.env.example server/.env
```

Trong PowerShell, lệnh tương đương là `Copy-Item server/.env.example server/.env`. Điền `MONGODB_URI` trỏ đến MongoDB local hoặc MongoDB Atlas và thay `JWT_SECRET` bằng chuỗi ngẫu nhiên đủ dài. Nếu sử dụng Atlas, cần cấu hình tài khoản database và danh sách IP được truy cập ở Atlas trước khi chạy.

```bash
npm run seed
npm run dev
```

Lệnh seed bổ sung dữ liệu minh họa, không phải lệnh xóa toàn bộ cơ sở dữ liệu. Không dùng các tài khoản và mật khẩu mẫu trên một hệ thống công khai.

### Build, kiểm thử và chạy bản build

```bash
npm test
npm run build
npm start
```

`npm test` chạy kiểm thử API bằng MongoDB dành riêng cho test. `npm run build` biên dịch frontend vào `client/dist`. Sau khi đã cấu hình MongoDB, `npm start` khởi động Express và phục vụ bản build ở **http://localhost:5000**. Khi phát triển giao diện, dùng `npm run dev` để có tự động tải lại.

## Sử dụng theo vai trò

Khi đăng nhập bằng tài khoản giảng viên, mở phần quản lý khóa học để tạo lớp và chọn danh mục. Khóa học ở trạng thái bản nháp chưa xuất hiện trong danh sách ghi danh của sinh viên. Sau khi thêm nội dung, giảng viên chuyển lớp sang trạng thái mở. Trong mỗi lớp, giảng viên có thể quản lý bài học, giao bài tập có hạn nộp, xem danh sách sinh viên và nhập điểm kèm nhận xét cho từng bài nộp.

Sinh viên tìm khóa học đang mở rồi ghi danh. Sau khi vào lớp, sinh viên đọc nội dung, mở liên kết video hoặc tải PDF và đánh dấu từng bài đã hoàn thành. Bài tập hỗ trợ nội dung văn bản hoặc tệp đính kèm. Điểm chỉ xuất hiện khi giảng viên đã chấm; bài đã chấm không được ghi đè bằng lần nộp mới.

Quản trị viên quản lý danh mục và các khóa học trên hệ thống, đồng thời khóa hoặc mở khóa tài khoản khi cần. Tài khoản bị khóa không thể tiếp tục sử dụng API dù còn giữ JWT cũ.

## Cấu trúc mã nguồn

```text
client/                 React, routing, Context, các trang và CSS
server/src/models/      Schema Mongoose
server/src/controllers/ Xử lý nghiệp vụ
server/src/routes/      Các endpoint REST
server/src/middleware/  Xác thực, phân quyền và xử lý yêu cầu
docs/                   Báo cáo và tài liệu kỹ thuật
screenshots/            Ảnh chụp các màn hình chạy thực tế
scripts/report/         Mã tạo lại báo cáo
```

Dữ liệu chính gồm Users, Courses, Enrollments và Assignments. Các collection Categories, Lessons và Submissions lưu danh mục, học liệu và bài nộp. Enrollment nối một sinh viên với một khóa học, còn Submission nối sinh viên với một bài tập. Các cặp này có unique index để tránh ghi danh hoặc tạo bài nộp trùng.

## Chuẩn bị nộp GitHub

Repository cần có mã nguồn, lockfile, README và báo cáo. `.gitignore` đã loại `node_modules`, các tệp `.env`, dữ liệu MongoDB cục bộ, tệp upload và bản build. Chỉ `.env.example` được đưa vào repository vì tệp này mô tả cấu hình mà không chứa khóa bí mật thật.

Trước khi commit, kiểm tra `git status` và nội dung các tệp được stage. Tạo một repository mới trên GitHub, chọn public hoặc cấp quyền cho giảng viên nếu để private, sau đó thực hiện các lệnh sau với URL repository của bạn:

```bash
git init
git add .
git status
git commit -m "Hoan thanh he thong lop hoc truc tuyen MERN"
git branch -M main
git remote add origin <URL_REPOSITORY_CUA_BAN>
git push -u origin main
```

Không đưa mật khẩu Atlas, JWT secret hoặc tệp chứa dữ liệu cá nhân lên repository. Link GitHub chỉ được coi là đã có khi mã nguồn được push thành công; dự án cục bộ không tự tạo ra một link GitHub.
