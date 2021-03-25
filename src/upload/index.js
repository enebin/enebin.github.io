import { Form } from "antd";
import "./index.css";

function UploadPage() {
  const onSubmit = (values) => {
    console.log(values);
  };
  return (
    <div>
      <Form name="상품 업로드" onFinish={onSubmit}>
        <Form.Item name="upload">
          <div id="upload-img-placeholder">
            <img src="/images/icons/camera.png" alt="camera" />
            <span>이미지를 업로드해주세요.</span>
          </div>
        </Form.Item>
      </Form>
    </div>
  );
}

export default UploadPage;
