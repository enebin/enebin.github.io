import React from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";

const Home = () => {
  return (
    <>
      <AppLayout>
        <Link href="/about">
          <a>about</a>
        </Link>
        <div>Hello, Next!!</div>
      </AppLayout>
    </>
  );
};

export default Home;
