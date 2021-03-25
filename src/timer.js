import React from "react";

function TimerComponent() {
  const [time, setTime] = React.useState(0);
  console.log("compo update");
  React.useEffect(function () {
    setTime(time + 1);
  }, []);
  return (
    <div>
      <h3>{time}sec</h3>
      <button>1 up</button>
    </div>
  );
}

export default TimerComponent;
