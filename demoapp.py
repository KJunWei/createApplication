from beaker import *
from pyteal import *


class DemoAppState:
    """
    Optional States
    """


app = Application("DemoApp", state=DemoAppState())


@app.create(bare=True)
def create():
    return app.initialize_global_state()


@app.opt_in(bare=True)
def opt_in():
    return app.initialize_local_state()


@app.close_out(bare=True)
def close_out():
    return Approve()


@app.delete(bare=True, authorize=Authorize.only(Global.creator_address()))
def delete():
    return Approve()

@app.external
def create_application(
    global_num_uints: abi.Uint64,
    global_num_byte_slices: abi.Uint64,
    local_num_uints: abi.Uint64,
    local_num_byte_slices: abi.Uint64,
    approval_program: abi.String,
    clear_state_program: abi.String,
    *,
    output: abi.Uint64
):
    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.ApplicationCall,
                TxnField.global_num_uints: global_num_uints.get(),
                TxnField.global_num_byte_slices: global_num_byte_slices.get(),
                TxnField.local_num_uints: local_num_uints.get(),
                TxnField.local_num_byte_slices: local_num_byte_slices.get(),
                TxnField.approval_program: approval_program.get(),
                TxnField.clear_state_program: clear_state_program.get(),
            }
        ),
        InnerTxnBuilder.Submit(),
        output.set(InnerTxn.created_application_id()),
    )

if __name__ == "__main__":
    app.build().export("./artifacts")
