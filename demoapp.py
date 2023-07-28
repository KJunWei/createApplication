from beaker import *
from pyteal import *

class DemoAppState:
    accounts_creatable = GlobalStateValue(
        stack_type=TealType.uint64,
        key=Bytes("accounts_creatable"),
        default=Int(100),
        descr="number of creatable accounts",
    )
    
app = Application("DemoApp", state=DemoAppState())

@app.create(bare=True)
def create():
    return Seq(
        app.initialize_global_state(),
)


@app.opt_in(bare=True)
def opt_in():
    return app.initialize_local_state()


@app.close_out(bare=True)
def close_out():
    return Approve()


@app.delete(bare=True, authorize=Authorize.only(Global.creator_address()))
def delete():
    return Approve()

@Subroutine(TealType.bytes)
def convert_uint_to_bytes(arg):
    string = ScratchVar(TealType.bytes)
    num = ScratchVar(TealType.uint64)
    digit = ScratchVar(TealType.uint64)

    return If(
        arg == Int(0),
        Bytes("0"),
        Seq([
            string.store(Bytes("")),
            For(num.store(arg), num.load() > Int(0), num.store(num.load() / Int(10))).Do(
                Seq([
                    digit.store(num.load() % Int(10)),
                    string.store(
                        Concat(
                            Substring(
                                Bytes('0123456789'),
                                digit.load(),
                                digit.load() + Int(1)
                            ),
                            string.load()
                        )
                    )
                ])

            ),
            string.load()
        ]))


@app.external
def create_application(
    global_num_uints: abi.Uint64,
    global_num_byte_slices: abi.Uint64,
    local_num_uints: abi.Uint64,
    local_num_byte_slices: abi.Uint64,
    approval_program: abi.String,
    clear_state_program: abi.String,
    extra_program_pages: abi.Uint64,
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
                TxnField.accounts: Txn.accounts,
                TxnField.assets: Txn.assets,
                TxnField.applications: Txn.applications
            }
        ),
        InnerTxnBuilder.Submit(),
        If(app.state.accounts_creatable.get() == Int(100), App.box_put(Bytes("accounts"), Bytes("_" * 1000))),
        App.box_replace(Bytes("accounts"), (Int(100) - app.state.accounts_creatable.get()) * Int(10), convert_uint_to_bytes(InnerTxn.created_application_id())),
        app.state.accounts_creatable.set(app.state.accounts_creatable.get() - Int(1)),
        output.set(InnerTxn.created_application_id()),
    )

if __name__ == "__main__":
    app.build().export("./artifacts")
